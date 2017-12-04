#!/bin/env node

/**
 * @name deploy.js
 * This script deploys final files to amazon s3. Designed to be used through 'npm run deploy'.
 *
 * @arg version
 * You can pass an argument, defining the subfolder it will be uploaded to:
 *
 * (empty): <npm run deploy>
 * Will use 'lastbuild', ie: 'js/core/lastbuild/'
 *
 * 'version': <npm run deploy version>
 * Will use the current version specified in 'package.json', ie: js/core/0.1/
 *
 * (string): <npm run deploy beta>
 * Will use the said string, ie: js/core/beta/
 */

const pkg = require('../package.json')
const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')

// config
let version = process.argv[2] || 'lastbuild'
if (version === 'version') version = pkg.version
const s3BucketName = process.env['AWS_BUCKET_NAME']
const awsId = process.env['AWS_ACCESS_KEY_ID']
const awsSecret = process.env['AWS_ACCESS_KEY_SECRET']

// missing var error
let missing = []
if (!s3BucketName) missing.push('AWS_BUCKET_NAME')
if (!awsId) missing.push('AWS_ACCESS_KEY_ID')
if (!awsSecret) missing.push('AWS_ACCESS_KEY_SECRET')
if (missing.length > 0) {
  console.error('Error: Env variables to publish are missing. Please define:', missing)
  process.exit(1)
}

// initialize S3 client
const s3 = new AWS.S3({
  signatureVersion: 'v4',
  accessKeyId: awsId,
  secretAccessKey: awsSecret
})

// upload files
const baseDir = 'trackers/js/' + pkg.name + '/' + version + '/'
uploadFolder(path.join(__dirname, '../dist'), baseDir + 'dist/')
uploadFolder(path.join(__dirname, '../samples'), baseDir + 'samples/')
uploadFile('CHANGELOG.md', path.join(__dirname, '..'), baseDir)
uploadFile('README.md', path.join(__dirname, '..'), baseDir)
uploadFile('package.json', path.join(__dirname, '..'), baseDir)

// copy agent.js
s3.copyObject({
  Bucket: 'nr-video-samples',
  CopySource: 'nr-video-samples/agent.js',
  Key: baseDir + 'samples/agent.js'
}, function (err, data) {
  if (err) {
    console.log(err, err.stack)
  } else {
    console.log(`Successfuly copied 'agent.js' to '${baseDir}samples/agent.js'.`)
  }
})

// upload folders
function uploadFolder (originPath, targetPath) {
  fs.readdir(originPath, (err, files) => {
    if (err) console.error(err)

    // Add trailing '/'
    if (targetPath[targetPath.length - 1] !== '/') targetPath += '/'

    if (!files || files.length === 0) {
      console.log(`Provided folder '${originPath}' is empty or does not exist.`)
      return
    }

    // for each file in the directory
    for (const fileName of files) {
      uploadFile(fileName, originPath, targetPath)
    }
  })
}

// upload files
function uploadFile (fileName, originPath, targetPath) {
  // get the full path of the file
  const filePath = path.join(originPath, fileName)

  let isHtml = fileName.endsWith('.html')

  // Add trailing '/'
  if (targetPath[targetPath.length - 1] !== '/') targetPath += '/'
  if (originPath[originPath.length - 1] !== '/') originPath += '/'

  // recurse if directory
  if (fs.lstatSync(filePath).isDirectory()) {
    uploadFolder(originPath + fileName, targetPath + fileName)
  } else {
    // read file contents
    fs.readFile(filePath, (error, fileContent) => {
      // if unable to read file contents, throw exception
      if (error) { throw error }

      // upload file to S3
      s3.putObject({
        ACL: 'public-read',
        Bucket: s3BucketName,
        Key: targetPath + fileName,
        Body: fileContent,
        ContentType: isHtml ? 'text/html' : undefined
      }, (res) => {
        console.log(`Successfully uploaded '${fileName}' in '${targetPath}'.`)
      })
    })
  }
}
