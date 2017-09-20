# snappit-visual-regression

[![Greenkeeper badge](https://badges.greenkeeper.io/rackerlabs/snappit-visual-regression.svg)](https://greenkeeper.io/)
An NPM module for visual regression testing.

# Releasing

[Grab the password for the "Node Package Manager Deploys"](https://passwordsafe.corp.rackspace.com/projects/2285) on password safe.

```
cd ~/code/js/snappit-visual-regression
npm login
Username: encore-ui
Password:
Email: (this IS public) encore-ui@lists.rackspace.com
Logged in as encore-ui on https://registry.npmjs.org/.
npm version --minor
npm publish
git push origin v${TAG_VERSION}
```
