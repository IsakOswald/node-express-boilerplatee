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
    }
}