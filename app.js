// Global variables
let mediaRecorder;
let audioChunks = [];
let tracks = [];
let isRecording = false;
let audioStream; // Store the audio stream globally

// DOM Elements
const allowMicrophoneButton = document.getElementById('allow-microphone');
const recordingButton = document.getElementById('start-recording'); // We'll use this single button
const tracksList = document.getElementById('tracks-list');

// Request microphone access
allowMicrophoneButton.addEventListener('click', async () => {
    try {
        // Stop any existing stream before requesting a new one
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
        }
        
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        allowMicrophoneButton.disabled = true;
        recordingButton.disabled = false;
        
        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(audioStream);
        
        // Set up MediaRecorder event handlers
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const trackId = Date.now();
            
            // Add track to tracks array
            tracks.push({
                id: trackId,
                url: audioUrl,
                name: `Track ${tracks.length + 1}`
            });
            
            // Create track element and get the audio element
            const audioElement = createTrackElement(trackId, audioUrl);
            
            // Reset for next recording
            audioChunks = [];
            isRecording = false;
            recordingButton.disabled = false;
            recordingButton.textContent = 'START';
            recordingButton.setAttribute('data-recording', 'false');

            // Start playing the track
            if (audioElement) {
                try {
                    // Ensure audio is loaded before playing
                    await audioElement.load();
                    await audioElement.play();
                } catch (error) {
                    console.error('Autoplay failed:', error);
                }
            }
        };
    } catch (error) {
        console.error('Error accessing microphone:', error);
        allowMicrophoneButton.disabled = false;
    }
});

// Toggle recording
recordingButton.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            // Ensure we have a valid stream
            if (!audioStream || audioStream.getTracks().some(track => track.readyState === 'ended')) {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(audioStream);
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };
            }
            
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            recordingButton.textContent = 'STOP';
            recordingButton.setAttribute('data-recording', 'true');
        } catch (error) {
            console.error('Error starting recording:', error);
            recordingButton.disabled = false;
        }
    } else {
        try {
            mediaRecorder.stop();
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
    }
});

// Create track element with playback controls
function createTrackElement(trackId, audioUrl) {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';
    trackDiv.id = `track-${trackId}`;
    
    // Add delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'DELETE';
    deleteButton.className = 'delete-button';
    deleteButton.addEventListener('click', () => {
        // Remove from tracks array
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            tracks.splice(trackIndex, 1);
        }
        // Remove the track element
        trackDiv.remove();
    });

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = audioUrl;
    audio.loop = false; // We'll handle looping manually
    audio.preload = 'auto';
    
    // Create editable track name
    const trackNameDiv = document.createElement('div');
    const trackNameInput = document.createElement('input');
    trackNameInput.type = 'text';
    trackNameInput.value = `Track ${tracks.length}`;
    trackNameInput.className = 'track-name';
    
    // Update track name in tracks array when changed
    trackNameInput.addEventListener('change', () => {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
            track.name = trackNameInput.value;
        }
    });
    
    trackNameDiv.appendChild(trackNameInput);
    
    // Create start point control
    const startPointDiv = document.createElement('div');
    const startPointLabel = document.createElement('label');
    startPointLabel.textContent = 'Start (seconds): ';
    const startPointInput = document.createElement('input');
    startPointInput.type = 'number';
    startPointInput.min = '0';
    startPointInput.step = '0.1';
    startPointInput.value = '0';
    startPointDiv.appendChild(startPointLabel);
    startPointDiv.appendChild(startPointInput);

    // Create end point control
    const endPointDiv = document.createElement('div');
    const endPointLabel = document.createElement('label');
    endPointLabel.textContent = 'End (seconds): ';
    const endPointInput = document.createElement('input');
    endPointInput.type = 'number';
    endPointInput.min = '0';
    endPointInput.step = '0.1';
    endPointInput.value = '0';
    endPointDiv.appendChild(endPointLabel);
    endPointDiv.appendChild(endPointInput);

    // Update end point max value when audio is loaded
    audio.addEventListener('loadedmetadata', () => {
        endPointInput.max = audio.duration;
        endPointInput.value = audio.duration.toFixed(1);
        startPointInput.max = audio.duration;
    });

    // Validate start point
    startPointInput.addEventListener('change', () => {
        const startValue = parseFloat(startPointInput.value);
        const endValue = parseFloat(endPointInput.value);
        
        if (startValue > endValue) {
            startPointInput.value = endValue;
        }
        if (startValue < 0) {
            startPointInput.value = 0;
        }
        if (startValue > audio.duration) {
            startPointInput.value = audio.duration;
        }
    });

    // Validate end point
    endPointInput.addEventListener('change', () => {
        const startValue = parseFloat(startPointInput.value);
        const endValue = parseFloat(endPointInput.value);
        
        if (endValue < startValue) {
            endPointInput.value = startValue;
        }
        if (endValue < 0) {
            endPointInput.value = 0;
        }
        if (endValue > audio.duration) {
            endPointInput.value = audio.duration;
        }
    });

    // Create loop toggle button
    const loopButton = document.createElement('button');
    let isLooping = false; // Set looping to false by default
    loopButton.textContent = 'LOOP';
    loopButton.setAttribute('data-looping', 'false');
    let isAudioReady = false;

    // Wait for audio to be ready
    audio.addEventListener('canplaythrough', () => {
        isAudioReady = true;
    });

    loopButton.addEventListener('click', () => {
        if (!isAudioReady) {
            console.log('Audio not ready yet');
            return;
        }

        isLooping = !isLooping;
        loopButton.setAttribute('data-looping', isLooping.toString());
        
        if (isLooping) {
            // Always start from the start point when enabling loop
            audio.currentTime = parseFloat(startPointInput.value);
            audio.play();
        } else {
            audio.pause();
        }
    });

    // Handle playback with start/end points
    audio.addEventListener('timeupdate', () => {
        if (!isAudioReady) return;

        const currentTime = audio.currentTime;
        const startTime = parseFloat(startPointInput.value);
        const endTime = parseFloat(endPointInput.value);

        if (currentTime >= endTime) {
            if (isLooping) {
                audio.currentTime = startTime;
                audio.play();
            } else {
                audio.pause();
                audio.currentTime = startTime;
            }
        }
    });

    // Add apply button to update playback points
    const applyButton = document.createElement('button');
    applyButton.textContent = 'SET RANGE';
    applyButton.setAttribute('data-action', 'set-range');
    applyButton.addEventListener('click', () => {
        if (!isAudioReady) return;

        const newStartTime = parseFloat(startPointInput.value);
        audio.currentTime = newStartTime;
        
        if (isLooping) {
            audio.play();
        }
    });

    trackDiv.appendChild(trackNameDiv);
    trackDiv.appendChild(audio);
    trackDiv.appendChild(startPointDiv);
    trackDiv.appendChild(endPointDiv);
    trackDiv.appendChild(loopButton);
    trackDiv.appendChild(applyButton);
    trackDiv.appendChild(deleteButton);
    tracksList.appendChild(trackDiv);

    return audio;
} 