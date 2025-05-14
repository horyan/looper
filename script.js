class AudioLooper {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.tracks = [];
        this.isRecording = false;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.recordingStartTime = 0;
        this.timerInterval = null;

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
            
            // Start timer
            this.recordingStartTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please make sure you have granted microphone permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.recordBtn.disabled = false;
            this.stopBtn.disabled = true;

            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    addTrack(audioUrl) {
        const trackId = Date.now();
        const track = {
            id: trackId,
            audio: new Audio(audioUrl),
            isPlaying: false
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
            <div class="track-name">Track ${this.tracks.length + 1}</div>
            <audio src="${audioUrl}" controls></audio>
        `;

        // Add event listeners for track controls
        trackElement.querySelector('.play-btn').addEventListener('click', () => this.playTrack(trackId));
        trackElement.querySelector('.stop-btn').addEventListener('click', () => this.stopTrack(trackId));
        trackElement.querySelector('.delete-btn').addEventListener('click', () => this.deleteTrack(trackId));

        this.tracksContainer.appendChild(trackElement);
        this.tracks.push(track);
    }

    playTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            track.audio.currentTime = 0;
            track.audio.loop = true;
            track.audio.play();
            track.isPlaying = true;
            
            // Add active class to track element
            const trackElement = document.querySelector(`[data-id="${trackId}"]`).closest('.track');
            trackElement.classList.add('active');

            // Add ended event listener to remove active class
            track.audio.addEventListener('ended', () => {
                trackElement.classList.remove('active');
            });
        }
    }

    stopTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            track.audio.pause();
            track.audio.currentTime = 0;
            track.isPlaying = false;
            
            // Remove active class from track element
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

    playAllTracks() {
        this.tracks.forEach(track => {
            if (!track.isPlaying) {
                track.audio.currentTime = 0;
                track.audio.loop = true;
                track.audio.play();
                track.isPlaying = true;
                
                // Add active class to track element
                const trackElement = document.querySelector(`[data-id="${track.id}"]`).closest('.track');
                trackElement.classList.add('active');
            }
        });
    }

    stopAllTracks() {
        this.tracks.forEach(track => {
            track.audio.pause();
            track.audio.currentTime = 0;
            track.isPlaying = false;
            
            // Remove active class from track element
            const trackElement = document.querySelector(`[data-id="${track.id}"]`).closest('.track');
            trackElement.classList.remove('active');
        });
    }
}

// Initialize the audio looper when the page loads
window.addEventListener('load', () => {
    new AudioLooper();
}); 