const pkg = require('../package.json')
const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')

// config
const version = process.argv[2] || pkg.version
const s3BucketName = 'nr-video-samples'
const awsId = process.env['AWS-ACCESS-KEY-ID']
const awsSecret = process.env['AWS-ACCESS-KEY-SECRET']

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

// upload folders
function uploadFolder (originPath, targetPath) {
  fs.readdir(originPath, (err, files) => {
    if (err) console.error(err)

    // Add trailing '/'
    if (targetPath[targetPath.length - 1] !== '/') targetPath += '/'

    if (!files || files.length === 0) {
      console.log(`provided folder '${originPath}' is empty or does not exist.`)
      console.log('Make sure your project was compiled!')
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

    // recurse if directory
  if (fs.lstatSync(filePath).isDirectory()) {
    uploadFolder(originPath, targetPath)
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
