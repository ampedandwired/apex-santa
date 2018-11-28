# Apex Santa Tracker
Santa tracker for the annual Berowra Apex Club Santa street run.

## Architecture
The Santa tracker is a simple in-browser javascript app written with vue.js.
It consists purely of static files - there is no build process required.
The app is deployed to AWS using CloudFormation and served from S3 and CloudFront.
Maps are served from some custom Google maps.
TLS certificate is pulled from AWS ACM.

When Santa is on the move, he accesses the app via a special URL that includes an AWS key and secret.
This causes the app to periodically upload a file to S3 indicating his current position.
A timeout loop in the app then constantly polls this file to refresh his location on the map for end users.

## Running locally
You can run the app locally for development using the Python web server app in `bin/run.py`.
Running this way will generate a self-signed cert for you (Google maps won't work over plain HTTP),
and will provide an S3 alternative for handling Santa's position file uploads.

The easiest way to run this is to use Docker - just run `docker-compose up`.
After it's started it will print the "Public URL" and "Santa URL" to the console - you should be able to simply open these in your browser.
You will get a certificate warning as the local app uses self-signed certs - just ignore this.

## Deploying to AWS
Run bin/deploy.py. You will need valid AWS keys of course.
This script will look up AWS ACM to find the cert and run the CloudFormation stack in `cloudformation/apexsanta_template.json`.
There are a few configurable params at the top of the file.

## Updating the dates
The Santa events are defined in `site/events.js`. Just update the fields appropriately.

## Maps
Maps were created with Google My Maps. You can draw the Santa route on them.
Then you have to share the maps publically and paste the key into the `id` field in events.js.
