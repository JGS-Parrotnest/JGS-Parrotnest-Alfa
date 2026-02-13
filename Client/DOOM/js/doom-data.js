var Module;
if (typeof Module === 'undefined') Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');
if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;
(function() {
    var PACKAGE_PATH;
    if (typeof window === 'object') {
      PACKAGE_PATH = "https://js-dos.com/games/";
    } else {
      PACKAGE_PATH = "https://js-dos.com/games/";
    }
    var PACKAGE_NAME = '/home/caiiiycuk/js/js-dos.com/build/games/doom.exe.data';
    var REMOTE_PACKAGE_BASE = PACKAGE_PATH+'doom.exe.data';
    if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
      Module['locateFile'] = Module['locateFilePackage'];
      Module.printErr('warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)');
    }
    var REMOTE_PACKAGE_NAME = typeof Module['locateFile'] === 'function' ?
                              Module['locateFile'](REMOTE_PACKAGE_BASE) :
                              ((Module['filePackagePrefixURL'] || '') + REMOTE_PACKAGE_BASE);
    var REMOTE_PACKAGE_SIZE = 13731014;
    var PACKAGE_UUID = '133e8b91-0165-4224-b0f9-913f537bb216';
    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', packageName, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function(event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
          var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil(total * Module.expectedDataFileDownloads/num);
          if (Module['setStatus']) Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
        } else if (!Module.dataFileDownloads) {
          if (Module['setStatus']) Module['setStatus']('Downloading data...');
        }
      };
      xhr.onload = function(event) {
        var packageData = xhr.response;
        callback(packageData);
      };
      xhr.send(null);
    };
    function handleError(error) {
      console.error('package error:', error);
    };
      var fetched = null, fetchedCallback = null;
      fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, function(data) {
        if (fetchedCallback) {
          fetchedCallback(data);
          fetchedCallback = null;
        } else {
          fetched = data;
        }
      }, handleError);
  function runWithFS() {
    function assert(check, msg) {
      if (!check) throw msg + new Error().stack;
    }
    function DataRequest(start, end, crunched, audio) {
      this.start = start;
      this.end = end;
      this.crunched = crunched;
      this.audio = audio;
    }
    DataRequest.prototype = {
      requests: {},
      open: function(mode, name) {
        this.name = name;
        this.requests[name] = this;
        Module['addRunDependency']('fp ' + this.name);
      },
      send: function() {},
      onload: function() {
        var byteArray = this.byteArray.subarray(this.start, this.end);
          this.finish(byteArray);
      },
      finish: function(byteArray) {
        var that = this;
        Module['FS_createPreloadedFile'](this.name, null, byteArray, true, true, function() {
          Module['removeRunDependency']('fp ' + that.name);
        }, function() {
          if (that.audio) {
            Module['removeRunDependency']('fp ' + that.name); 
          } else {
            Module.printErr('Preloading file ' + that.name + ' failed');
          }
        }, false, true); 
        this.requests[this.name] = null;
      },
    };
    new DataRequest(0, 67, 0, 0).open('GET', '/MODEM.NUM');
    new DataRequest(67, 2603, 0, 0).open('GET', '/DWANGO.STR');
    new DataRequest(2603, 6008, 0, 0).open('GET', '/MODEM.STR');
    new DataRequest(6008, 82906, 0, 0).open('GET', '/DMFAQ66C.TXT');
    new DataRequest(82906, 87595, 0, 0).open('GET', '/HELPME.TXT');
    new DataRequest(87595, 108532, 0, 0).open('GET', '/DM.EXE');
    new DataRequest(108532, 12516824, 0, 0).open('GET', '/DOOM.WAD');
    new DataRequest(12516824, 12551396, 0, 0).open('GET', '/DMFAQ66D.TXT');
    new DataRequest(12551396, 12556013, 0, 0).open('GET', '/ORDER.FRM');
    new DataRequest(12556013, 12576270, 0, 0).open('GET', '/SERSETUP.EXE');
    new DataRequest(12576270, 12577041, 0, 0).open('GET', '/DEFAULT.CFG');
    new DataRequest(12577041, 12587664, 0, 0).open('GET', '/DWANGO.DOC');
    new DataRequest(12587664, 12609653, 0, 0).open('GET', '/README.TXT');
    new DataRequest(12609653, 12729854, 0, 0).open('GET', '/DMFAQ66A.TXT');
    new DataRequest(12729854, 13445347, 0, 0).open('GET', '/DOOM.EXE');
    new DataRequest(13445347, 13585941, 0, 0).open('GET', '/DMFAQ66B.TXT');
    new DataRequest(13585941, 13603992, 0, 0).open('GET', '/IPXSETUP.EXE');
    new DataRequest(13603992, 13677630, 0, 0).open('GET', '/DWANGO.EXE');
    new DataRequest(13677630, 13677885, 0, 0).open('GET', '/DWANGO.SRV');
    new DataRequest(13677885, 13684282, 0, 0).open('GET', '/DM.DOC');
    new DataRequest(13684282, 13684349, 0, 0).open('GET', '/MODEM.CFG');
    new DataRequest(13684349, 13731014, 0, 0).open('GET', '/SETUP.EXE');
    function processPackageData(arrayBuffer) {
      Module.finishedDataFileDownloads++;
      assert(arrayBuffer, 'Loading data file failed.');
      var byteArray = new Uint8Array(arrayBuffer);
      var curr;
      DataRequest.prototype.byteArray = byteArray;
      DataRequest.prototype.requests["/MODEM.NUM"].onload();
      DataRequest.prototype.requests["/DWANGO.STR"].onload();
      DataRequest.prototype.requests["/MODEM.STR"].onload();
      DataRequest.prototype.requests["/DMFAQ66C.TXT"].onload();
      DataRequest.prototype.requests["/HELPME.TXT"].onload();
      DataRequest.prototype.requests["/DM.EXE"].onload();
      DataRequest.prototype.requests["/DOOM.WAD"].onload();
      DataRequest.prototype.requests["/DMFAQ66D.TXT"].onload();
      DataRequest.prototype.requests["/ORDER.FRM"].onload();
      DataRequest.prototype.requests["/SERSETUP.EXE"].onload();
      DataRequest.prototype.requests["/DEFAULT.CFG"].onload();
      DataRequest.prototype.requests["/DWANGO.DOC"].onload();
      DataRequest.prototype.requests["/README.TXT"].onload();
      DataRequest.prototype.requests["/DMFAQ66A.TXT"].onload();
      DataRequest.prototype.requests["/DOOM.EXE"].onload();
      DataRequest.prototype.requests["/DMFAQ66B.TXT"].onload();
      DataRequest.prototype.requests["/IPXSETUP.EXE"].onload();
      DataRequest.prototype.requests["/DWANGO.EXE"].onload();
      DataRequest.prototype.requests["/DWANGO.SRV"].onload();
      DataRequest.prototype.requests["/DM.DOC"].onload();
      DataRequest.prototype.requests["/MODEM.CFG"].onload();
      DataRequest.prototype.requests["/SETUP.EXE"].onload();
      Module['removeRunDependency']('datafile_/home/caiiiycuk/js/js-dos.com/build/games/doom.exe.data');
    };
    Module['addRunDependency']('datafile_/home/caiiiycuk/js/js-dos.com/build/games/doom.exe.data');
    if (!Module.preloadResults) Module.preloadResults = {};
      Module.preloadResults[PACKAGE_NAME] = {fromCache: false};
      if (fetched) {
        processPackageData(fetched);
        fetched = null;
      } else {
        fetchedCallback = processPackageData;
      }
  }
  if (Module['calledRun']) {
    runWithFS();
  } else {
    if (!Module['preRun']) Module['preRun'] = [];
    Module["preRun"].push(runWithFS);
  }
})();
Module['arguments'] = [ '-conf', './dosbox.conf', './DOOM.EXE' ];
