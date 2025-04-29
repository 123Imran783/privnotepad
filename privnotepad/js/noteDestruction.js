// Note destruction functionality
class NoteDestruction {
    constructor() {
        this.destroyTimer = null;
        this.note = null;
        this.destroyButton = null;
        this.timeoutId = null;
    }

    // Initialize note with destruction settings
    initializeNote(noteContent, destructionTime, autoDestroy = true) {
        this.note = {
            content: noteContent,
            createdAt: new Date(),
            expiryTime: destructionTime ? new Date(Date.now() + destructionTime * 60000) : null,
            autoDestroy: autoDestroy
        };

        // If there's an expiry time, set up the timer
        if (this.note.expiryTime) {
            this.setupDestructionTimer();
        }

        // If auto-destroy is enabled, set up view detection
        if (this.note.autoDestroy) {
            this.setupAutoDestruction();
        }

        return this.generateNoteLink();
    }

    // Set up timer for time-based destruction
    setupDestructionTimer() {
        const timeUntilExpiry = this.note.expiryTime - new Date();
        
        if (timeUntilExpiry > 0) {
            this.timeoutId = setTimeout(() => {
                this.showDestroyButton();
            }, timeUntilExpiry);
        } else {
            this.showDestroyButton();
        }
    }

    // Show destroy button after expiry
    showDestroyButton() {
        if (!this.destroyButton) {
            this.destroyButton = document.createElement('button');
            this.destroyButton.className = 'btn btn-danger mt-3';
            this.destroyButton.innerHTML = '<i class="fas fa-trash-alt me-2"></i>Notiz zerstören';
            this.destroyButton.addEventListener('click', () => this.destroyNote());
            
            const noteContainer = document.querySelector('#noteContainer');
            if (noteContainer) {
                noteContainer.appendChild(this.destroyButton);
            }
        }
    }

    // Set up auto-destruction on view
    setupAutoDestruction() {
        // Add visibility detection
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.note) {
                this.destroyNote();
            }
        });

        // Add focus detection as backup
        window.addEventListener('focus', () => {
            if (this.note) {
                this.destroyNote();
            }
        });
    }

    // Generate unique link for the note
    generateNoteLink() {
        const uniqueId = this.generateUniqueId();
        return `${window.location.origin}/view-note.html?id=${uniqueId}`;
    }

    // Generate unique ID for the note
    generateUniqueId() {
        return 'note_' + Math.random().toString(36).substr(2, 9);
    }

    // Destroy note and clean up
    async destroyNote() {
        if (!this.note) return;

        try {
            // Show destruction animation
            await this.showDestructionAnimation();

            // Clear any existing timers
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }

            // Remove note from storage
            this.removeNoteFromStorage();

            // Clean up UI
            this.cleanupUI();

            // Show destruction confirmation
            this.showDestructionConfirmation();

        } catch (error) {
            console.error('Fehler beim Zerstören der Notiz:', error);
            this.showErrorMessage();
        }
    }

    // Show destruction animation
    async showDestructionAnimation() {
        return new Promise(resolve => {
            const noteElement = document.querySelector('#noteContent');
            if (noteElement) {
                noteElement.style.transition = 'all 0.5s ease';
                noteElement.style.opacity = '0';
                noteElement.style.transform = 'scale(0.8)';
                
                setTimeout(resolve, 500);
            } else {
                resolve();
            }
        });
    }

    // Remove note from storage
    removeNoteFromStorage() {
        // Implementation will depend on your storage method (localStorage, IndexedDB, or server)
        this.note = null;
    }

    // Clean up UI elements
    cleanupUI() {
        const noteContainer = document.querySelector('#noteContainer');
        if (noteContainer) {
            noteContainer.innerHTML = '';
        }

        if (this.destroyButton) {
            this.destroyButton.remove();
            this.destroyButton = null;
        }
    }

    // Show destruction confirmation message
    showDestructionConfirmation() {
        const container = document.querySelector('#noteContainer');
        if (container) {
            const confirmationMessage = document.createElement('div');
            confirmationMessage.className = 'alert alert-success mt-3';
            confirmationMessage.innerHTML = `
                <i class="fas fa-check-circle me-2"></i>
                Die Notiz wurde erfolgreich zerstört
            `;
            container.appendChild(confirmationMessage);
        }
    }

    // Show error message if destruction fails
    showErrorMessage() {
        const container = document.querySelector('#noteContainer');
        if (container) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'alert alert-danger mt-3';
            errorMessage.innerHTML = `
                <i class="fas fa-exclamation-circle me-2"></i>
                Fehler beim Zerstören der Notiz. Bitte versuchen Sie es erneut.
            `;
            container.appendChild(errorMessage);
        }
    }

    // Check if note has expired
    hasNoteExpired() {
        if (!this.note || !this.note.expiryTime) return false;
        return new Date() >= this.note.expiryTime;
    }

    // Get remaining time until expiry
    getRemainingTime() {
        if (!this.note || !this.note.expiryTime) return null;
        const remaining = this.note.expiryTime - new Date();
        return remaining > 0 ? remaining : 0;
    }
}

// Export the class
window.NoteDestruction = NoteDestruction; 