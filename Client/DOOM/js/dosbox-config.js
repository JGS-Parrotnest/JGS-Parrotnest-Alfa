var Module = {
    noImageDecoding: true,
    preRun: [],
    postRun: [],
    print: (function() {
        var element = document.getElementById('output');
        if (element) element.value = '';
        return function(text) {
            text = Array.prototype.slice.call(arguments).join(' ');
            console.log(text);
            if (element) {
                element.value += text + "\n";
                element.scrollTop = element.scrollHeight;
            }
        };
    })(),
    printErr: function(text) {
        text = Array.prototype.slice.call(arguments).join(' ');
        if (0) {
            dump(text + '\n');
        } else {
            console.error(text);
        }
    },
    canvas: (function() {
        var canvas = document.getElementById('canvas');
        canvas.addEventListener("webglcontextlost", function(e) { alert('WebGL context lost. You will need to reload the page.'); e.preventDefault(); }, false);
        return canvas;
    })(),
    setStatus: function(text) {
        console.log(text);
    },
    totalDependencies: 0,
    monitorRunDependencies: function(left) {
        this.totalDependencies = Math.max(this.totalDependencies, left);
        if (left == 0) {
            $('.fullscreen').show();
        }
    },
    SDL_numSimultaneouslyQueuedBuffers: 1
};
Module.setStatus('Downloading...');
window.onerror = function(event) {
    Module.setStatus('Exception thrown, see JavaScript console');
    Module.setStatus = function(text) {
        if (text) Module.printErr('[post-exception status] ' + text);
    };
};
$(document).ready(function () {
    $("#fullscreen").click(function() {
        Module.requestFullScreen(false, false);
    });
    $.ajax({
        url: "https://js-dos.com/dosbox.js",
        dataType: "script",
        error: function(jqXHR, textStatus, error) {
            console.log(textStatus, error);
        },
        xhr: function() {
            var xhr;
            Module.setStatus("Downloading script");
            xhr = $.ajaxSettings.xhr();
            xhr.addEventListener("progress", function(evt) {
                if (evt.lengthComputable) {
                    Module.setStatus("Downloading script... (" + evt.loaded + "/" + evt.total + ")");
                }
            });
            return xhr;
        }
    });
});
