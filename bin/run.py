#!/usr/bin/env python
import os
import logging
import http.server
import ssl

logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)

PORT = 4443
SCRIPT_DIR = os.path.realpath(os.path.dirname(__file__))
SITE_DIR = os.path.realpath(os.path.join(SCRIPT_DIR, "../site"))
CERT_FILE = os.path.join(SCRIPT_DIR, "server.pem")

class SantaRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        # Handle updates to Santa's location.
        # Normally this goes to S3, but when running locally we just post to local server.
        # Just write the request body to the file specified by the path.
        length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(length).decode('utf-8')
        output_file = os.path.join(SITE_DIR, self.path[1:])
        output_dir = os.path.dirname(output_file)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        with open(output_file, "w") as f:
            f.write(post_data)

        self.send_response(201, "OK")
        self.end_headers()


# Generate server https certificate if it doesn't already exist
if not os.path.isfile(CERT_FILE):
    logging.info("Generating SSL certificate")
    ret = os.system('openssl req -new -x509 -keyout {} -out {} -days 365 -nodes -subj "/C=AU/ST=NSW/L=Sydney/O=Apex/CN=localhost"'.format(CERT_FILE, CERT_FILE))
    if ret != 0:
        print("Failed to generate SSL certificate. Make sure 'openssl' is installed.")
        exit(1)

os.chdir(SITE_DIR)
httpd = http.server.HTTPServer(('0.0.0.0', PORT), SantaRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket, certfile=CERT_FILE, server_side=True)
logging.info("Public URL: https://localhost:{}".format(PORT))
logging.info("Santa URL:  https://localhost:{}?id=x&secret=y".format(PORT))
httpd.serve_forever()
