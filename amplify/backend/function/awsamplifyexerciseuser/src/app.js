const express = require('express')
const bodyParser = require('body-parser')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client();

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  next()
});


app.get('/users/presignedUrlUpload', async function(req, res) {
  let fileName = req.body.fileName;

  if (!fileName) {
    fileName = uuidv4();
  }

  const bucketParams = {
    Bucket: 'awsamplifyexercises',
    Key: `avatars/${fileName}`,
  };

  const command = new PutObjectCommand(bucketParams);
  const presignedURL = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });

  res.json({
    url: presignedURL
  })
});

app.listen(3000, function() {
    console.log('App started')
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
