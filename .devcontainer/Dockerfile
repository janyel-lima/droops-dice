FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install Java (required for Firebase Emulators)
RUN apt-get update && apt-get install -y default-jre

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=dialog
