pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'Source code checked out by Jenkins'
            }
        }

        stage('Build') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run test:coverage'
            }
        }

        stage('Code Quality') {
            steps {
                sh 'npm run lint'
                sh 'npm run type-check'
                sh 'npm run format:check'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'

                    withSonarQubeEnv('SonarQube') {
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Security') {
            steps {
                sh 'npm audit --omit=dev --audit-level=high'

                sh '''
                    docker build \
                      -f Dockerfile.production \
                      -t node-express-boilerplatee:${BUILD_NUMBER} .
                '''

                sh '''
                    trivy image \
                      --scanners vuln \
                      --severity HIGH,CRITICAL \
                      --exit-code 1 \
                      node-express-boilerplatee:${BUILD_NUMBER}
                '''
            }
        }
    }
}