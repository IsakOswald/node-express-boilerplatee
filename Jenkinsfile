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

        stage('Deploy') {
            steps {
                sh '''
                    docker rm -f node-express-staging 2>/dev/null || true

                    docker run -d \
                    --name node-express-staging \
                    --env-file .env.example \
                    -e NODE_ENV=production \
                    -p 5051:5050 \
                    node-express-boilerplatee:${BUILD_NUMBER}
                '''

                sh '''
                    echo "Waiting for staging deployment..."

                    for i in 1 2 3 4 5 6 7 8 9 10; do
                        if curl --fail --silent \
                        http://localhost:5051/api/v1/health/ready > /dev/null; then
                            echo "Staging deployment is healthy"
                            exit 0
                        fi

                        echo "Attempt $i: service not ready yet"
                        sleep 3
                    done

                    echo "Staging deployment failed health check"
                    docker logs node-express-staging
                    exit 1
                '''
            }
        }

        stage('Release') {
            steps {
                sh '''
                    docker tag \
                    node-express-boilerplatee:${BUILD_NUMBER} \
                    node-express-boilerplatee:release-${BUILD_NUMBER}

                    docker rm -f node-express-production 2>/dev/null || true

                    docker run -d \
                    --name node-express-production \
                    --env-file .env.example \
                    -e NODE_ENV=production \
                    -p 5052:5050 \
                    node-express-boilerplatee:release-${BUILD_NUMBER}
                '''

                sh '''
                    echo "Waiting for production release..."

                    for i in 1 2 3 4 5 6 7 8 9 10; do
                        if curl --fail --silent \
                        http://localhost:5052/api/v1/health/ready > /dev/null; then
                            echo "Production release is healthy"
                            exit 0
                        fi

                        echo "Attempt $i: production not ready yet"
                        sleep 3
                    done

                    echo "Production release failed health check"
                    docker logs node-express-production
                    exit 1
                '''
            }
        }

        stage('Monitoring') {
            steps {
                sh '''
                    echo "Checking production metrics endpoint..."

                    curl --fail --silent \
                    http://localhost:5052/metrics > /dev/null

                    echo "Checking Prometheus target status..."

                    curl --fail --silent \
                    "http://localhost:9090/api/v1/query?query=up%7Bjob%3D%22node-express-production%22%7D" \
                    | grep '"value":\\[[^]]*,"1"\\]'

                    echo "Production monitoring is active"
                '''
            }
        }
    }
}