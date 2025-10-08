#!/bin/bash
mkdir -p ssl
openssl genrsa -out ssl/private-key.pem 2048
openssl req -new -key ssl/private-key.pem -out ssl/csr.pem -subj "/C=US/ST=CA/L=SF/O=FreewayCards/CN=localhost"
openssl x509 -req -days 365 -in ssl/csr.pem -signkey ssl/private-key.pem -out ssl/certificate.pem
rm ssl/csr.pem
echo "SSL certificates generated. Set SSL_KEY_PATH=./ssl/private-key.pem SSL_CERT_PATH=./ssl/certificate.pem"