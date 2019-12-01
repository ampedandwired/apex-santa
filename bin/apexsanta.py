#!/usr/bin/env python

import os
import time
import boto3
import botocore


class ApexSanta:
    AWS_REGION = "ap-southeast-2"
    SCRIPT_DIR = os.path.realpath(os.path.dirname(__file__))
    SITE_DIR = os.path.join(SCRIPT_DIR, "../site")
    STACK_NAME = "apexsanta"
    SANTA_DOMAIN = "santa.berowraapex.org.au"
    TEMPLATE_FILE = os.path.join(SCRIPT_DIR, "../cloudformation/apexsanta_template.json")

    def __init__(self):
        self.cfn = boto3.client("cloudformation", self.AWS_REGION)
        with open(self.TEMPLATE_FILE) as f:
            self.template = f.read()

    def get_stack(self):
        try:
            return self.cfn.describe_stacks(StackName=self.STACK_NAME)
        except botocore.exceptions.ClientError as e:
            if 'does not exist' in str(e):
                return None
            else:
                raise e

    def create_or_update_stack(self):
        stack = self.get_stack()
        if stack:
            self.update_stack()
        else:
            self.create_stack()

    def update_stack(self):
        print("Updating stack...")
        try:
            self.cfn.update_stack(StackName=self.STACK_NAME, TemplateBody=self.template, Capabilities=['CAPABILITY_IAM'],
                Parameters=[{
                    'ParameterKey': 'AcmCertificateArn',
                    'ParameterValue': self.get_certificate_arn()
                }],
            )
            self.wait_for_stack_complete()
            print("Stack updated")
        except botocore.exceptions.ClientError as e:
            if 'No updates are to be performed' in str(e):
                print("Stack up to date")
            else:
                raise e

    def create_stack(self):
        print("Creating stack - this could take up to 40 minutes...")
        self.cfn.create_stack(StackName=self.STACK_NAME, TemplateBody=self.template, Capabilities=['CAPABILITY_IAM'],
            Parameters=[{
                'ParameterKey': 'AcmCertificateArn',
                'ParameterValue': self.get_certificate_arn()
            }],
        )
        self.wait_for_stack_complete()
        print("Stack created")


    def delete_stack(self):
        print("Deleting stack...")
        self.cfn.delete_stack(StackName=self.STACK_NAME, Capabilities=['CAPABILITY_IAM'])
        self.wait_for_stack_complete()
        print("Stack deleted")

    def wait_for_stack_complete(self):
        while True:
            time.sleep(10)
            stack = self.cfn.describe_stacks(StackName=self.STACK_NAME)['Stacks'][0]
            status = stack['StackStatus']
            print("Stack status: {}".format(status))
            if status.endswith("_COMPLETE"):
                break


    def get_outputs(self):
        stack = self.get_stack()
        if stack:
            return stack['Stacks'][0]['Outputs']
        else:
            return {}

    def print_outputs(self):
        outputs = self.get_outputs()
        if outputs:
            print("--------------------------------------------------------------------------------")
            for output in outputs:
                print(" - ".join([output['Description'], output['OutputValue']]))

            print("--------------------------------------------------------------------------------")

    def get_certificate_arn(self):
        # CloudFront certificates are only supported in the us-east-1 region
        acm = boto3.client('acm', 'us-east-1')
        certs = acm.list_certificates()
        santa_cert = next((cert for cert in certs['CertificateSummaryList'] if cert['DomainName'] == self.SANTA_DOMAIN), None)
        if not santa_cert:
            return create_certificate()
        else:
            return santa_cert['CertificateArn']

    def create_certificate():
        # Maybe one day this bit will be automated too...
        raise "Unable to find SSL certificate for {}. Please follow the readme instructions for creating the certificate.".format(self.SANTA_DOMAIN)


    def get_s3_bucket_name(self):
        outputs = self.get_outputs()
        s3_bucket_name_output = next(output for output in outputs if output['OutputKey'] == 'S3BucketName')
        if s3_bucket_name_output:
            return s3_bucket_name_output['OutputValue']
        else:
            return None

    def get_s3_uri(self):
        bucket_name = self.get_s3_bucket_name()
        return "s3://{}".format(bucket_name) if bucket_name else None


    def generate_config(self):
        config = 'var santa_config = {{ region: "{}", bucket: "{}", deploy_id: "{}" }};'.format(self.AWS_REGION, self.get_s3_bucket_name(), int(time.time()))
        with open(os.path.join(self.SITE_DIR, "config.js"), "w") as f:
            f.write(config)


    def upload_site(self):
        s3_uri = self.get_s3_uri()
        if s3_uri:
            print("Uploading site to {}...".format(s3_uri))
            self.generate_config()
            os.system("aws s3 sync --delete --exclude live/* --acl public-read ./site {}".format(s3_uri))
            print("Site uploaded")
        else:
            print("Could not find site URL, site not uploaded")

    def delete_site(self):
        s3_uri = self.get_s3_uri()
        if s3_uri:
            print("Deleting site from {}...".format(s3_uri))
            os.system("aws s3 rm --recursive {}".format(s3_uri))
            print("Site deleted")
        else:
            print("Could not find site URL, site not deleted")

    def deploy(self):
        self.create_or_update_stack()
        self.upload_site()
        self.print_outputs()

    def undeploy(self):
        self.delete_site()
        self.delete_stack()

if __name__ == "__main__":
    ApexSanta().deploy()
