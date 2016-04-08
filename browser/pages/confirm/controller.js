'use strict';

let dialog = require('remote').require('dialog');
/*import {remote, ipcRenderer} from 'electron-prebuilt';*/
let fs = require('fs');
let path = require('path');
let ipcRenderer = require('electron').ipcRenderer;

class ConfirmController {

  constructor($scope, $state, $timeout, installerDataSvc) {
    this.router = $state;
    this.sc = $scope;
    this.timeout = $timeout;
    this.installerDataSvc = installerDataSvc;
    
    this.installables = {};
    $scope.checkboxModel = {};

    $scope.detectionStyle = false;
    
    for (var [key, value] of this.installerDataSvc.allInstallables().entries()) {
      $scope.checkboxModel[key] = value;
    }

    $scope.isConfigurationValid = this.isConfigurationValid;

    $scope.$watch(()=>{
      return $scope.checkboxModel.jdk.isConfigured()
    },(nVal,oVal)=>{
      if(nVal===false) {
        $scope.checkboxModel.jbds.selected = false;
      }
    });
    
    $scope.$watch('$viewContentLoaded', ()=>{
      console.log('content loaded');
      $scope.checkboxModel.virtualbox.detectExistingInstall(()=> {
        $scope.checkboxModel.vagrant.detectExistingInstall(()=> {
          $scope.checkboxModel.jdk.detectExistingInstall(()=> {
            $timeout(()=>{
              $scope.detectionStyle = false;
              $scope.$apply();
            });
          });
        });
      });
    });
  }

  // Get the install location if you can. Check if there is an existing install. 
  itemRoot(key) {
    let root = this.installables[key] ? this.installables[key][0].existingInstallLocation : null;
    if (root && (root.length === 0 || !this.installables[key][0].existingInstall)) {
      root = null;
    }
    return root;
  }

  // Prep the install location path for each product, then go to the next page.
  install() {
    this.installerDataSvc.setup(
      this.itemRoot('virtualbox'),
      this.itemRoot('jdk'),
      this.itemRoot('jbds'),
      this.itemRoot('vagrant'),
      this.itemRoot('cygwin'),
      this.itemRoot('cdk')
    );
    this.router.go('install');
  }

  // Open up a browse dialog and select the dir that has the installed product you are looking for.
  selectItem(key) {
    let selection = dialog.showOpenDialog({
      properties: [ 'openDirectory' ],
      defaultPath: this.installables[key] && this.installables[key][0].existingInstallLocation ? this.installables[key][0].existingInstallLocation : this.installerDataSvc.installRoot
    });
    
    let item = this.installerDataSvc.allInstallables().get(key);

    // If the browsed for dir is found then expect it to be JBDS
    if (selection) {
      // only JBDS at the moment
      item.checkForExistingInstall(selection, this.installables);
    } else {
      this.timeout(()=>{
        this.sc.$apply(()=>{
          item.detectExistingInstall();
        })
      });
    }
  }

  // Check if the product is already installed
  // ATM this is only JBDS 
  checkItem(key) {
    let item = this.installerDataSvc.allInstallables().get(key);
    item.checkForExistingInstall();
  }

  isConfigurationValid() {
    return this.checkboxModel.virtualbox.isConfigured()
        && this.checkboxModel.cygwin.isConfigured()
        && this.checkboxModel.vagrant.isConfigured()
        && this.checkboxModel.cdk.isConfigured();
  }
}

ConfirmController.$inject = ['$scope', '$state', '$timeout', 'installerDataSvc'];

export default ConfirmController;
