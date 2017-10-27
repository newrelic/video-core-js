import newrelic.jenkins.extensions

use(extensions) {
  def project = 'video'
  def _repo = 'video/core'
  def _email = 'jaguilargorina@newrelic.com'
  def slackChannel = 'video-monitoring-bot'
  def viewName = 'core'
  def viewDescription = 'Jobs for building/testing Video Core'

  baseJob("${project}-reseed") {
    repo _repo
    email _email
    branch 'master'
    label 'master'

    configure {
      steps {
        reseedFrom('jenkins/build/*.groovy')
      }
    }
  }

  baseJob("${project}-push-to-master") {
    repo _repo
    email _email
    label 'ec2-linux'

    configure { p ->
      logRotator(-1, 50, -1, 50)

      repositoryPR(repo) {
        clean()
      }

      wrappers {
        colorizeOutput('xterm')
      }

      triggers {
        githubPush()
      }

      publishers {
        violations(50) {
          // sunnyThreshold, stormyThreshold, unstableThreshold, filePath
          checkstyle(0, 1, 999, 'eslint.xml')
        }
        slack(slackChannel)
      }

      steps {
        dockerExecStep('jenkins', 'jenkins/scripts/build.sh')
      }
    }
  }

  view(viewName, viewDescription, "^${project}-(?!server|admin).*")
}