#!/usr/bin/env python
import os
import logging
import http.server
import ssl

logging.basicConfig(level=logging.INFO)

PORT = 4444
SCRIPT_DIR = os.path.realpath(os.path.dirname(__file__))
SITE_DIR = os.path.realpath(os.path.join(SCRIPT_DIR, "../site"))
CERT_FILE = os.path.join(SCRIPT_DIR, "server.pem")

if not os.path.isfile(CERT_FILE):
    logging.info("Generating SSL certificate")
    ret = os.system('openssl req -new -x509 -keyout {} -out {} -days 365 -nodes -subj "/C=AU/ST=NSW/L=Sydney/O=Apex/CN=localhost"'.format(CERT_FILE, CERT_FILE))
    if ret != 0:
        print("Failed to generate SSL certificate. Make sure 'openssl' is installed.")
        exit(1)

os.chdir(SITE_DIR)
httpd = http.server.HTTPServer(('localhost', PORT), http.server.SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket, certfile=CERT_FILE, server_side=True)
logging.info("Serving Santa on https://localhost:{}".format(PORT))
httpd.serve_forever()
