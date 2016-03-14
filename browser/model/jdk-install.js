'use strict';

let fs = require('fs');
let path = require('path');
let ipcRenderer = require('electron').ipcRenderer;

import InstallableItem from './installable-item';
import Downloader from './helpers/downloader';
import Logger from '../services/logger';
import Installer from './helpers/installer';
import CDKInstall from './cdk';
import Util from './helpers/util';

class JdkInstall extends InstallableItem {
  constructor(installerDataSvc, downloadUrl, installFile) {
    super('JDK 8', 260, downloadUrl, installFile);

    this.installerDataSvc = installerDataSvc;
    this.downloadedFileName = 'jdk8.zip';
    this.downloadedFile = path.join(this.installerDataSvc.tempDir(), this.downloadedFileName);
  }

  checkForExistingInstall(selection, data) {
    let versionRegex = /version\s\"\d+\.(\d+)\.\d+_\d+\"/;
    let selectedFolder = '';

    let extension = '';
    let command;
    if (process.platform === 'win32') {
      command = 'java -XshowSettings';
      if (selection) {
        extension = '.exe';
      }
    } else {
      command = 'which java';
    }

    if(selection) {
      command = '';
      this.existingInstallLocation = selection[0] || this.existingInstallLocation;
      selectedFolder = path.join(this.existingInstallLocation, 'bin') + path.sep;
    }

    Util.executeFile(selectedFolder + 'java' + extension, ['-version'], 2)
    .then((output) => {
      return new Promise((resolve, reject) => {
        let version = versionRegex.exec(output)[1];
        if (!version || version < 8) {
          reject('wrong version');
        } else {
          resolve(true);
        }
      });
    }).then((output) => {
      return Util.executeCommand(command, 2);
    }).then((output) => {

      if (selection && data) {
        data[JdkInstall.key()][1] = true;
      } else {
        var locationRegex = /java.home*\s=*\s(.*)[\s\S]/;
        var t = locationRegex.exec(output);
        if(t.length > 1) {
          this.existingInstallLocation = t[1];
          this.existingInstall = true;
        }
      }
      ipcRenderer.send('checkComplete', JdkInstall.key());
    }).catch((error) => {
      if (data) {
        data[JdkInstall.key()][1] = false;
      }
      this.existingInstall = false;
      ipcRenderer.send('checkComplete', JdkInstall.key());
    });
  }

  static key() {
    return 'jdk';
  }

  downloadInstaller(progress, success, failure) {
    progress.setStatus('Downloading');
    var downloads = path.normalize(path.join(__dirname,"../../.."));
    console.log(downloads);
    if(!this.hasExistingInstall() && !fs.existsSync(path.join(downloads, this.downloadedFileName))) {
      // Need to download the file
      let writeStream = fs.createWriteStream(this.downloadedFile);
      let downloader = new Downloader(progress, success, failure);
      downloader.setWriteStream(writeStream);
      downloader.download(this.downloadUrl);
    } else {
      this.downloadedFile = path.join(downloads, this.downloadedFileName);
      success();
    }
  }

  install(progress, success, failure) {
    let cdkInstall = this.installerDataSvc.getInstallable(CDKInstall.key());
    if(!this.hasExistingInstall()) {
      progress.setStatus('Installing');
      let installer = new Installer(JdkInstall.key(), progress, success, failure);

      installer.unzip(this.downloadedFile, this.installerDataSvc.installDir())
          .then((result) => {
            return this.getFolderContents(this.installerDataSvc.installDir(), result);
          })
          .then((files) => {
            return this.getFileByName('zulu', files)
          })
          .then((fileName) => {
            return this.renameFile(this.installerDataSvc.installDir(), fileName, this.installerDataSvc.jdkDir());
          })
          .then((result) => {
            return installer.succeed(result);
          })
          .catch((error) => {
            return installer.fail(error);
          });
    } else {
      success();
    }
  }

  setup(progress, success, failure) {
    //no need to setup anything for JDK
    progress.setStatus('Setting up');
    progress.setComplete();
    success();
  }

  getFolderContents(parentFolder, result) {
    return new Promise(function (resolve, reject) {
      fs.readdir(parentFolder, function(err, fileList) {
        if (err) {
          Logger.error(JdkInstall.key() + ' - ' + err);
          reject(err);
        } else {
          resolve(fileList);
        }
      });
    });
  }

  getFileByName(name, files) {
    return new Promise(function (resolve) {
      for (let fileName of files) {
        if (fileName.startsWith(name)) {
          resolve(fileName);
          break;
        }
      }
    });
  }

  renameFile(folder, oldName, newName) {
    let filePath = path.join(folder, oldName)
    Logger.info(JdkInstall.key() + ' - Rename ' + filePath + 'to ' + newName)
    return new Promise(function (resolve, reject) {
      fs.rename(filePath, newName, function(err) {
        if (err) {
          Logger.error(JdkInstall.key() + ' - ' + err);
          reject(err);
        } else {
          Logger.info(JdkInstall.key() + ' - Rename ' + filePath + 'to ' + newName + ' SUCCESS')
          resolve(true);
        }
      });
    });
  }
}

export default JdkInstall;
