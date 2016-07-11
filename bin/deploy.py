#!/usr/bin/env python

import os
import boto3
import botocore


class ApexSanta:
    def __init__(self, stack_name="apexsanta", template_file="cloudformation/apexsanta_template.json"):
        self.cfn = boto3.client("cloudformation")
        self.stack_name = stack_name
        with open(template_file) as f:
            self.template = f.read()

    def get_stack(self):
        try:
            return self.cfn.describe_stacks(StackName=self.stack_name)
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
            self.cfn.update_stack(StackName=self.stack_name, TemplateBody=self.template, Capabilities=['CAPABILITY_IAM'])
            waiter = self.cfn.get_waiter('stack_update_complete')
            waiter.wait(StackName=self.stack_name)
            print("Stack updated")
        except botocore.exceptions.ClientError as e:
            if 'No updates are to be performed' in str(e):
                print("Stack up to date")
            else:
                raise e

    def create_stack(self):
        print("Creating stack...")
        self.cfn.create_stack(StackName=self.stack_name, TemplateBody=self.template, Capabilities=['CAPABILITY_IAM'])
        waiter = self.cfn.get_waiter('stack_create_complete')
        waiter.wait(StackName=self.stack_name)
        print("Stack created")


    def delete_stack(self):
        print("Deleting stack...")
        self.cfn.delete_stack(StackName=self.stack_name, Capabilities=['CAPABILITY_IAM'])
        waiter = self.cfn.get_waiter('stack_delete_complete')
        waiter.wait(StackName=self.stack_name)
        print("Stack deleted")


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

    def get_s3_uri(self):
        outputs = self.get_outputs()
        s3_uri_output = next(output for output in outputs if output['OutputKey'] == 'S3BucketUri')
        if s3_uri_output:
            return s3_uri_output['OutputValue']
        else:
            return None

    def upload_site(self):
        s3_uri = self.get_s3_uri()
        if s3_uri:
            print("Uploading site to {}...".format(s3_uri))
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
