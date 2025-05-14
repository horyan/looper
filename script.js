class AudioLooper {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.tracks = [];
        this.isRecording = false;
        this.audioContext = null;
        this.recordingStartTime = 0;
        this.timerInterval = null;
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // DOM Elements
        this.recordBtn = document.getElementById('recordBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.playAllBtn = document.getElementById('playAllBtn');
        this.stopAllBtn = document.getElementById('stopAllBtn');
        this.tracksContainer = document.getElementById('tracksContainer');
        this.timerDisplay = document.getElementById('timer');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.recordBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.playAllBtn.addEventListener('click', () => this.playAllTracks());
        this.stopAllBtn.addEventListener('click', () => this.stopAllTracks());

        // Initialize audio context on first user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.initializeAudioContext();
            }
        }, { once: true });
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.error('Error initializing audio context:', error);
            this.showError('Audio initialization failed. Please try refreshing the page.');
        }
    }

    showError(message) {
        alert(message);
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    updateTimer() {
        const elapsedTime = Date.now() - this.recordingStartTime;
        this.timerDisplay.textContent = this.formatTime(elapsedTime);
    }

    async startRecording() {
        try {
            if (!this.audioContext) {
                await this.initializeAudioContext();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                this.addTrack(audioUrl);
                clearInterval(this.timerInterval);
                this.timerDisplay.textContent = '00:00';
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            this.recordingStartTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showError('Error accessing microphone. Please make sure you have granted microphone permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.recordBtn.disabled = false;
            this.stopBtn.disabled = true;

            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    addTrack(audioUrl) {
        const trackId = Date.now();
        const track = {
            id: trackId,
            audio: new Audio(audioUrl),
            isPlaying: false,
            startTime: 0,
            endTime: 0,
            duration: 0,
            name: `Track ${this.tracks.length + 1}`
        };

        // Create track element
        const trackElement = document.createElement('div');
        trackElement.className = 'track';
        trackElement.innerHTML = `
            <div class="track-controls">
                <button class="btn play-btn" data-id="${trackId}">Play</button>
                <button class="btn stop-btn" data-id="${trackId}">Stop</button>
                <button class="btn delete-btn" data-id="${trackId}">Delete</button>
            </div>
            <div class="track-name" data-id="${trackId}">${track.name}</div>
            <div class="range-slider-container">
                <input type="range" class="range-slider start" min="0" max="100" value="0" data-id="${trackId}" step="0.001">
                <input type="range" class="range-slider end" min="0" max="100" value="100" data-id="${trackId}" step="0.001">
                <div class="range-labels">
                    <span class="start-time">0:00</span>
                    <span class="end-time">0:00</span>
                </div>
            </div>
            <audio src="${audioUrl}" controls></audio>
        `;

        // Add event listeners for track controls
        trackElement.querySelector('.play-btn').addEventListener('click', () => this.playTrack(trackId));
        trackElement.querySelector('.stop-btn').addEventListener('click', () => this.stopTrack(trackId));
        trackElement.querySelector('.delete-btn').addEventListener('click', () => this.deleteTrack(trackId));

        // Add event listener for track name editing
        const trackNameElement = trackElement.querySelector('.track-name');
        trackNameElement.addEventListener('click', () => this.startEditingTrackName(trackId));
        trackNameElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.finishEditingTrackName(trackId);
            } else if (e.key === 'Escape') {
                this.cancelEditingTrackName(trackId);
            }
        });

        // Add event listeners for range sliders
        const startSlider = trackElement.querySelector('.range-slider.start');
        const endSlider = trackElement.querySelector('.range-slider.end');
        const startTimeLabel = trackElement.querySelector('.start-time');
        const endTimeLabel = trackElement.querySelector('.end-time');

        // Initialize audio duration when metadata is loaded
        track.audio.addEventListener('loadedmetadata', () => {
            // Round duration to 3 decimal places to avoid floating point issues
            track.duration = Math.round(track.audio.duration * 1000) / 1000;
            
            // Set slider max values
            startSlider.max = track.duration;
            endSlider.max = track.duration;
            
            // Set initial end value
            endSlider.value = track.duration;
            track.endTime = track.duration;
            
            // Update labels
            this.updateTimeLabels(trackId, 0, track.duration);
            
            console.log(`Track ${trackId} loaded with duration: ${track.duration}s`);
        });

        // Handle start slider changes
        startSlider.addEventListener('input', (e) => {
            const value = Math.round(parseFloat(e.target.value) * 1000) / 1000;
            const endValue = Math.round(parseFloat(endSlider.value) * 1000) / 1000;
            
            // Ensure minimum gap between start and end
            const minGap = 0.1;
            if (value >= endValue - minGap) {
                e.target.value = (endValue - minGap).toFixed(3);
                return;
            }
            
            track.startTime = parseFloat(e.target.value);
            this.updateTimeLabels(trackId, track.startTime, track.endTime);
            
            if (track.isPlaying) {
                if (track.audio.currentTime < track.startTime) {
                    track.audio.currentTime = track.startTime;
                }
            }
        });

        // Handle end slider changes
        endSlider.addEventListener('input', (e) => {
            const value = Math.round(parseFloat(e.target.value) * 1000) / 1000;
            const startValue = Math.round(parseFloat(startSlider.value) * 1000) / 1000;
            
            // Ensure minimum gap between start and end
            const minGap = 0.1;
            if (value <= startValue + minGap) {
                e.target.value = (startValue + minGap).toFixed(3);
                return;
            }
            
            track.endTime = parseFloat(e.target.value);
            this.updateTimeLabels(trackId, track.startTime, track.endTime);
            
            if (track.isPlaying) {
                if (track.audio.currentTime > track.endTime) {
                    track.audio.currentTime = track.startTime;
                }
            }
        });

        this.tracksContainer.appendChild(trackElement);
        this.tracks.push(track);
    }

    updateTimeLabels(trackId, startTime, endTime) {
        const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
        const startTimeLabel = trackElement.querySelector('.start-time');
        const endTimeLabel = trackElement.querySelector('.end-time');
        
        // Round times to 3 decimal places for consistency
        const roundedStartTime = Math.round(startTime * 1000) / 1000;
        const roundedEndTime = Math.round(endTime * 1000) / 1000;
        
        startTimeLabel.textContent = this.formatTime(roundedStartTime * 1000);
        endTimeLabel.textContent = this.formatTime(roundedEndTime * 1000);
    }

    async playTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            try {
                if (!this.audioContext) {
                    await this.initializeAudioContext();
                }

                // Reset and prepare audio
                const startTime = Math.round(track.startTime * 1000) / 1000;
                track.audio.currentTime = startTime;
                track.audio.loop = true;

                // Handle mobile autoplay
                if (this.isMobile) {
                    const playPromise = track.audio.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                track.isPlaying = true;
                                const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
                                trackElement.classList.add('active');
                                
                                // Add timeupdate listener for loop points
                                track.audio.addEventListener('timeupdate', () => {
                                    const currentTime = Math.round(track.audio.currentTime * 1000) / 1000;
                                    const endTime = Math.round(track.endTime * 1000) / 1000;
                                    
                                    if (currentTime >= endTime) {
                                        track.audio.currentTime = startTime;
                                    }
                                });
                            })
                            .catch(error => {
                                console.error('Playback failed:', error);
                                this.showError('Playback failed. Please try tapping the play button again.');
                            });
                    }
                } else {
                    await track.audio.play();
                    track.isPlaying = true;
                    const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
                    trackElement.classList.add('active');
                    
                    // Add timeupdate listener for loop points
                    track.audio.addEventListener('timeupdate', () => {
                        const currentTime = Math.round(track.audio.currentTime * 1000) / 1000;
                        const endTime = Math.round(track.endTime * 1000) / 1000;
                        
                        if (currentTime >= endTime) {
                            track.audio.currentTime = startTime;
                        }
                    });
                }

                // Add ended event listener
                track.audio.addEventListener('ended', () => {
                    const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
                    trackElement.classList.remove('active');
                });
            } catch (error) {
                console.error('Error playing track:', error);
                this.showError('Error playing track. Please try again.');
            }
        }
    }

    stopTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            track.audio.pause();
            track.audio.currentTime = 0;
            track.isPlaying = false;
            
            const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
            trackElement.classList.remove('active');
        }
    }

    deleteTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            track.audio.pause();
            track.audio.src = '';
            this.tracks = this.tracks.filter(t => t.id !== trackId);
            const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
            trackElement.remove();
        }
    }

    startEditingTrackName(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return;

        const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
        const trackNameElement = trackElement.querySelector('.track-name');
        
        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.value = track.name;
        input.maxLength = 50; // Limit name length
        
        // Clear and add input
        trackNameElement.textContent = '';
        trackNameElement.appendChild(input);
        trackNameElement.classList.add('editing');
        
        // Focus and select text
        input.focus();
        input.select();
    }

    finishEditingTrackName(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return;

        const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
        const trackNameElement = trackElement.querySelector('.track-name');
        const input = trackNameElement.querySelector('input');
        
        // Get new name and trim whitespace
        const newName = input.value.trim();
        
        // If name is empty, revert to default
        if (newName === '') {
            track.name = `Track ${this.tracks.indexOf(track) + 1}`;
        } else {
            track.name = newName;
        }
        
        // Update display
        trackNameElement.textContent = track.name;
        trackNameElement.classList.remove('editing');
    }

    cancelEditingTrackName(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return;

        const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
        const trackNameElement = trackElement.querySelector('.track-name');
        
        // Revert to original name
        trackNameElement.textContent = track.name;
        trackNameElement.classList.remove('editing');
    }

    async playAllTracks() {
        try {
            if (!this.audioContext) {
                await this.initializeAudioContext();
            }

            for (const track of this.tracks) {
                if (!track.isPlaying) {
                    track.audio.currentTime = 0;
                    track.audio.loop = true;

                    if (this.isMobile) {
                        const playPromise = track.audio.play();
                        if (playPromise !== undefined) {
                            await playPromise.catch(error => {
                                console.error('Playback failed:', error);
                                this.showError('Some tracks failed to play. Please try playing them individually.');
                            });
                        }
                    } else {
                        await track.audio.play();
                    }

                    track.isPlaying = true;
                    const trackElement = document.querySelector(`[data-id="${track.id}"]`).closest('.track');
                    trackElement.classList.add('active');
                }
            }
        } catch (error) {
            console.error('Error playing all tracks:', error);
            this.showError('Error playing tracks. Please try playing them individually.');
        }
    }

    stopAllTracks() {
        this.tracks.forEach(track => {
            track.audio.pause();
            track.audio.currentTime = 0;
            track.isPlaying = false;
            
            const trackElement = document.querySelector(`[data-id="${track.id}"]`).closest('.track');
            trackElement.classList.remove('active');
        });
    }
}

// Initialize the audio looper when the page loads
window.addEventListener('load', () => {
    new AudioLooper();
}); 