pipeline {
    // 'agent any' means run the pipeline on any available Jenkins agent.
    // In this setup, Jenkins is running on my Mac.
    agent any

    stages {

        stage('Checkout') {
            steps {
                // Jenkins already checks out the GitHub repository automatically.
                // This stage just confirms that the source code is available.
                echo 'Source code checked out by Jenkins'
            }
        }

        stage('Build') {
            steps {
                // Install the exact dependency versions from package-lock.json.
                sh 'npm ci'

                // Compile the TypeScript application.
                // If the build fails, Jenkins stops the pipeline.
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                // Run the automated Jest tests and generate test coverage.
                // This is defined in package.json.
                // A failed test causes this stage to fail.
                sh 'npm run test:coverage'
            }
        }

        stage('Code Quality') {
            steps {
                // Check the source code against ESLint rules.
                sh 'npm run lint'

                // Check that the TypeScript types are valid.
                sh 'npm run type-check'

                // Check that the code follows the project's formatting rules.
                sh 'npm run format:check'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    // Get the SonarScanner tool configured in Jenkins.
                    def scannerHome = tool 'SonarScanner'

                    // Connect to the SonarQube server configured in Jenkins.
                    // Jenkins also provides the stored SonarQube authentication token here.
                    withSonarQubeEnv('SonarQube') {

                        // Run the scanner and send the analysis to SonarQube.
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                // Wait for SonarQube to return the quality gate result.
                // The timeout prevents Jenkins from waiting forever.
                timeout(time: 2, unit: 'MINUTES') {

                    // If the SonarQube quality gate fails,
                    // abortPipeline: true makes Jenkins stop the pipeline.
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Security') {
            steps {
                // Check production npm dependencies for known vulnerabilities.
                // High or critical dependency issues can make this command fail.
                sh 'npm audit --omit=dev --audit-level=high'

                sh '''
                    # Build the production Docker image.
                    # BUILD_NUMBER is supplied automatically by Jenkins,
                    # so each pipeline run gets its own image tag.
                    docker build \
                      -f Dockerfile.production \
                      -t node-express-boilerplatee:${BUILD_NUMBER} .
                '''

                sh '''
                    # Scan the Docker image for HIGH and CRITICAL vulnerabilities.
                    # --exit-code 1 means Trivy will fail the Jenkins stage
                    # if one of these vulnerabilities is found.
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
                    # Remove the old staging container if it exists.
                    # If there is no old container, do not fail the pipeline.
                    docker rm -f node-express-staging 2>/dev/null || true

                    # Start the new Docker image as the staging environment.
                    # The app runs on port 5050 inside the container,
                    # and is exposed as port 5051 on my Mac.
                    docker run -d \
                      --name node-express-staging \
                      --env-file .env.example \
                      -e NODE_ENV=production \
                      -p 5051:5050 \
                      node-express-boilerplatee:${BUILD_NUMBER}
                '''

                sh '''
                    echo "Waiting for staging deployment..."

                    # Try the staging health endpoint up to 10 times.
                    # This gives the application time to start.
                    for i in 1 2 3 4 5 6 7 8 9 10; do

                        # If the readiness endpoint responds successfully,
                        # the staging deployment is considered healthy.
                        if curl --fail --silent \
                          http://localhost:5051/api/v1/health/ready > /dev/null; then
                            echo "Staging deployment is healthy"
                            exit 0
                        fi

                        echo "Attempt $i: service not ready yet"
                        sleep 3
                    done

                    # If all attempts fail, show the container logs
                    # and fail the Jenkins stage.
                    echo "Staging deployment failed health check"
                    docker logs node-express-staging
                    exit 1
                '''
            }
        }

        stage('Release') {
            steps {
                sh '''
                    # Give the already-tested Docker image a release tag.
                    # This does not rebuild the application.
                    # The same image that passed testing and security is promoted.
                    docker tag \
                      node-express-boilerplatee:${BUILD_NUMBER} \
                      node-express-boilerplatee:release-${BUILD_NUMBER}

                    # Remove the old production container if it exists.
                    docker rm -f node-express-production 2>/dev/null || true

                    # Start the release image as the production environment.
                    # The app runs on port 5050 inside the container,
                    # and is exposed as port 5052 on the Mac.
                    docker run -d \
                      --name node-express-production \
                      --env-file .env.example \
                      -e NODE_ENV=production \
                      -p 5052:5050 \
                      node-express-boilerplatee:release-${BUILD_NUMBER}
                '''

                sh '''
                    echo "Waiting for production release..."

                    # Try the production health endpoint up to 10 times.
                    for i in 1 2 3 4 5 6 7 8 9 10; do

                        # If the readiness endpoint responds successfully,
                        # the production release is considered healthy.
                        if curl --fail --silent \
                          http://localhost:5052/api/v1/health/ready > /dev/null; then
                            echo "Production release is healthy"
                            exit 0
                        fi

                        echo "Attempt $i: production not ready yet"
                        sleep 3
                    done

                    # If production never becomes healthy,
                    # show the container logs and fail the pipeline.
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

                    # Check that the running production application
                    # is exposing its Prometheus metrics.
                    curl --fail --silent \
                      http://localhost:5052/metrics > /dev/null

                    echo "Checking Prometheus target status..."

                    # Ask Prometheus whether it can currently scrape
                    # the production application.
                    #
                    # The query is the URL-encoded version of:
                    # up{job="node-express-production"}
                    #
                    # Prometheus returns a value of 1 when the target is up.
                    curl --fail --silent \
                      "http://localhost:9090/api/v1/query?query=up%7Bjob%3D%22node-express-production%22%7D" \
                      | grep '"value":\\[[^]]*,"1"\\]'

                    # Jenkins only reaches this line if both checks succeeded.
                    echo "Production monitoring is active"
                '''
            }
        }
    }
}