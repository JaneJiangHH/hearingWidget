var info = angular.module('info').component('info', {
    controller: ['$http', function InfoController($http) {
        var self = this;
        self.continue = function() {
            // if user does not log in, forward to customize page
            if(sessionStorage.getItem('userid') === null) {
                console.log("userid empty");
                window.location.href = '#/customize';
            } else {
                console.log("userid available");
                var paras = {"userid": null};
                paras.userid = sessionStorage.getItem('userid');
                // user logged in, check previous tests' customization
                $http.post('https://hearing-test-backend.herokuapp.com/api/get_row', paras).success(function(rows) {
                    // no test done before, so no customization
                    if(rows["ret_list"].length === 0) {
                        console.log('no tests before');
                        window.location.href = '#/customize';
                    } else {
                        console.log('tests available');
                        // get the last row of tests order by date
                        var lastIndex = rows["ret_list"].length - 1;
                        // set the parameters of the test
                        sessionStorage.setItem('rounds', rows["ret_list"][lastIndex].Rounds);
                        sessionStorage.setItem('technique', rows["ret_list"][lastIndex].Technique);
                        // no need to customize again, jump to adjustVolume page
                        window.location.href = '#/adjustVolume';
                    }
                });
            }
        }
    }]
});

var customizeTest = angular.module('customizeTest').component('customizeTest', {
    controller: function CustomizeController() {
        var self = this;
        self.rounds = 10;
        self.technique = 'adaptive';
        // self.parameters = TestPara.parameters;
        self.setParas = function setParas(r, t) {
            sessionStorage.setItem('rounds', r);
            sessionStorage.setItem('technique', t);
        };
    }
});

var adjustVolume = angular.module('adjustVolume').component('adjustVolume', {
    controller: ['ngAudio', function AdjustController(ngAudio) {
        var self = this;
        self.audio =  ngAudio.load('https://github.com/JaneJiangHH/hearingWidget/blob/master/sound/adjustVolume.mp3?raw=true');
        // set the default volume to 50%
        if(self.audio) {
            self.audio.volume = 0.5;
        }
        // test if the changes of rounds and technique applied
        console.log(sessionStorage.getItem('rounds'));
        console.log(sessionStorage.getItem('technique'));

        self.setPara = function setPara(v) {
            self.audio.stop();
            sessionStorage.setItem('volume', v);
            window.location.href = '#/test';
        }
    }]
});

var result = angular.module('result').component('result', {
    controller: function ResultController() {
        this.level = sessionStorage.getItem('hearingLevel');
        if(this.level <= 3 && this.level >= 1) {
            this.message = "From the result, it seems that you need to have a professional check of your hearing and perhaps get some hearing aid to improve your daily life quality";
        } else if(this.level >=4 && this.level <=7) {
            this.message = "Your hearing level is OK. It will not affect your daily life quality.";
        } else {
            this.message = "Congratulations! Your hearing level is above average. No need to worry about your hearing.";
        }
    }
});

var test = angular.module('test').component('test', {
    controller: ['$http', '$scope', function TestController($http, $scope) {
        // console.log(sessionStorage.getItem('rounds'));
        // console.log(sessionStorage.getItem('technique'));
        // console.log(sessionStorage.getItem('volume'));

        var self = this;
        var technique = sessionStorage.getItem('technique');
        var rounds = sessionStorage.getItem('rounds');
        var volume = sessionStorage.getItem('volume');
        var noiseLevel = 0;
        var roundTest = 0, wrong = 0, roundsPlayed = 0;
        var testParas = {"userid": null, "rounds": rounds, "technique": technique, "level": null};

        var triples = ['024','058','103','186','236','289','306','381','435','460','542','569','619','649','816','829','853','913','938','964'];
        
        // function for creating the route for a random triple-digit-sound
        self.randomTriple = function randomTriple() {
            // create a random number from 0 to 19
            self.random = Math.floor(Math.random()*(19 - 0 + 1) + 0);
            self.triple =  triples[self.random];
            // the route of the triple selected
            self.triplePath = 'https://github.com/JaneJiangHH/hearingWidget/blob/master/sound/triples/sound' + self.triple + '.wav?raw=true';
        };

        // initialize for playing sounds
        self.init = function init() {
            console.log(rounds);
            console.log(technique);
            switch(technique) {
                case 'adaptive':
                    noiseLevel = 1;
                    break;
                case 'binary':
                    noiseLevel = 5;
                    break;
                case 'root':
                    noiseLevel = 2;
            }

            // create a single instance of AudioContext, support multiple sound inputs
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            self.context = new AudioContext();

            // use XMLHttpRequest for fetching sound files
            self.request1 = new XMLHttpRequest();
            self.request2 = new XMLHttpRequest();
            // audio buffer for sounds
            self.noiseBuffer = null;
            self.tripleBuffer = null;
            // flags to confirm buffer loaded
            self.loadedNoise = false;
            self.loadedTriple =false;
            // flaf to confirm if sounds are played
            self.started = false;
            
            // gain nodes to connect source nodes and destination
            self.gainNode1 = self.context.createGain();
            self.gainNode2 = self.context.createGain();

            self.loadNoise();
            self.randomTriple();
            self.loadTriple(self.triplePath);
        };

        // function for loading noise sound
        self.loadNoise = function loadNoise() {
            self.request1.open('GET', 'https://github.com/JaneJiangHH/hearingWidget/blob/master/sound/noise.wav?raw=true', true);
            self.request1.responseType = 'arraybuffer';
            // decode asynchronously
            self.request1.onload = function() {
                self.context.decodeAudioData(self.request1.response, function(buffer) {
                    self.noiseBuffer = buffer;
                    // sound buffer loaded
                    self.loadedNoise = true;
                    // console.log("loadedNoise: "+self.loadedNoise);
                    self.startWhenAllLoaded();
                });
            };
            self.request1.send();
        };

        // funciton for loading speech sound
        self.loadTriple = function loadTriple(url) {
            self.request2.open('GET', url, true);
            self.request2.responseType = 'arraybuffer';
            self.request2.onload = function() {
                self.context.decodeAudioData(self.request2.response, function(buffer) {
                    self.tripleBuffer = buffer;
                    self.loadedTriple = true;
                    // console.log("loadedTriple: "+self.loadedTriple);
                    self.startWhenAllLoaded();
                });
            };
            self.request2.send();
        };

        // if all sound buffers loaded successfully, play the sounds
        self.startWhenAllLoaded = function startWhenAllLoaded() {
            if(!self.started && self.loadedTriple && self.loadedNoise) {
                self.started = true;
                self.playSounds(self.noiseBuffer, self.tripleBuffer);

                // after the sounds are played, set the flags to false for the next round
                self.started = false;
                self.loadedTriple = false;
                // self.loadedNoise = false;
            }
        };

        // play sounds
        self.playSounds = function playSounds(nb, tb) {
            
            // sound sources
             var source1 = self.context.createBufferSource();
            // tell the source node which sound to play
            source1.buffer = nb;
            var source2 = self.context.createBufferSource();
            source2.buffer = tb;
            // connect source nodes to gain nodes
            source1.connect(self.gainNode1);
            source2.connect(self.gainNode2);
            // connect gain nodes to the context's destination(the speakers)
            self.gainNode1.connect(self.context.destination);
            self.gainNode2.connect(self.context.destination);
            // set the volume to the volume obtained in adjustVolume component
            self.gainNode1.gain.value = volume * noiseLevel / 10;
            self.gainNode2.gain.value = volume;
            // play the sources now
            source1.start(0);
            source2.start(0);
        };

        // triggered when user enters the digits
        self.next = function next(answer) {
            roundTest++;
            roundsPlayed++;
            // each hearing level consists of 2 tests in succession
            // user have to answer at least 50% correctly to move on to next hearing level
            if(roundTest < 2) {
                if (answer !== self.triple) {
                    console.log("Correct answer:" + self.triple);
                    console.log(answer + ": is wrong");
                    wrong++;
                } else {
                    console.log("Correct answer:" + self.triple);
                    console.log(answer + ": is correct");
                }
            } else if(roundTest === 2) {
                if(answer === self.triple) {
                    if(technique === 'root' && roundsPlayed === 2) {
                        noiseLevel = 8;
                    } else {
                        noiseLevel = (noiseLevel === 10) ? 10 : (noiseLevel + 1);
                    }
                    // console.log("Correct answer:" + self.triple);
                    // console.log(answer + ": is correct");
                    console.log("Noise level is " + noiseLevel/10);
                } else {
                    wrong++;
                    if(technique === 'root') {
                        // root process: pass level 2, try level 8
                        if(roundsPlayed === 2 && wrong === 1) {
                            noiseLevel = 8;
                            console.log("Noise level is " + noiseLevel/10);
                        } else if(roundsPlayed === 4 && wrong === 2) {
                            // root process: pass level 2, fail level 8, choose a medium level--5
                            noiseLevel = 5;
                            console.log("Noise level is " + noiseLevel/10);
                        } else if(roundsPlayed !== 4 && wrong === 2) {
                            noiseLevel = (noiseLevel === 1) ? 1 : (noiseLevel - 1);
                            console.log("Noise level is " + noiseLevel/10);
                        } else if(roundsPlayed !== 2 && wrong === 1) {
                            noiseLevel = (noiseLevel === 10) ? 10 : (noiseLevel + 1);
                            console.log("Noise level is " + noiseLevel/10);
                        }
                    } else {
                        if(wrong === 2) {
                            // neither of 2 tests correct, decrease level
                            noiseLevel = (noiseLevel === 1) ? 1 : (noiseLevel - 1);
                            // console.log("Correct answer:" + self.triple);
                            // console.log(answer + ": is wrong");
                            console.log("Noise level is " + noiseLevel/10);
                        } else {
                            // wrong===1, answer 50% correctly, increase level
                            noiseLevel = (noiseLevel === 10) ? 10 : (noiseLevel + 1);
                            console.log("Noise level is " + noiseLevel/10);
                        }
                    }
                }
                roundTest = 0;
                wrong = 0;
            }
            console.log("rounds played:" + roundsPlayed);
            if(roundsPlayed >= rounds) {
                roundsPlayed = 0;
                sessionStorage.setItem('hearingLevel', noiseLevel);
                testParas.userid = sessionStorage.getItem('userid');
                testParas.level = noiseLevel;
                $http.post('https://hearing-test-backend.herokuapp.com/api/insert_new', testParas).success(function (result) {
                    if (result.created) {
                        console.log(result);
                    }
                });
                window.location.href = '#/result';
                // window.reload();
            } else {
                self.numbers = '';
                self.randomTriple();
                self.loadTriple(self.triplePath);
            }
        }

    }]
});

angular.element(document).ready(function() {
    var divWidget = document.getElementById("widget");
    angular.bootstrap(divWidget, ['info']);
});