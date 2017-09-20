# snappit-visual-regression

[![Greenkeeper badge](https://badges.greenkeeper.io/rackerlabs/snappit-visual-regression.svg)](https://greenkeeper.io/)
An NPM module for visual regression testing.

# Releasing

[Grab the password for the "Node Package Manager Deploys"](https://passwordsafe.corp.rackspace.com/projects/2285) on password safe.

```
cd ~/code/js/snappit-visual-regression
npm login
...
npm version --minor
npm publish
git push origin v${TAG_VERSION}
```
