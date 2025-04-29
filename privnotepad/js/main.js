// Remove dark mode functionality

// Note functionality
const noteForm = document.getElementById('noteForm');
const createNoteCard = document.getElementById('createNoteCard');
const linkCard = document.getElementById('linkCard');
const generatedLink = document.getElementById('generatedLink');
const copyLink = document.getElementById('copyLink');

// Constants for note limits
const NOTE_LIMITS = {
    MAX_CHARS: 500000,
    WARN_CHARS: 450000
};

// Generate a random key for encryption
function generateKey(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Encrypt the note content
function encryptNote(content, password = '') {
    const encryptionKey = generateKey();
    const combinedKey = password ? password + encryptionKey : encryptionKey;
    
    const encrypted = CryptoJS.AES.encrypt(content, combinedKey).toString();
    return { encrypted, key: encryptionKey };
}

// Store the note in localStorage with expiration
function storeNote(noteData, expirationTime) {
    const noteId = generateKey(16);
    const now = new Date().getTime();
    
    const noteObject = {
        content: noteData.encrypted,
        created: now,
        expiration: expirationTime === 'read' ? 'read' : now + (expirationTime * 60 * 1000)
    };

    localStorage.setItem(`note_${noteId}`, JSON.stringify(noteObject));
    return noteId;
}

// Add loading state to buttons
function setLoading(button, isLoading) {
    const originalContent = button.innerHTML;
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `
            <div class="loading-spinner"></div>
            <span class="ms-2">Processing...</span>
        `;
    } else {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}

// Enhanced form submission
noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    try {
        setLoading(submitButton, true);
        
        const noteContent = document.getElementById('noteContent').value;
        const password = document.getElementById('password').value;
        const expirationTime = document.getElementById('expirationTime').value;

        // Validate content
        validateNote(noteContent);
        
        // Show processing feedback
        showToast('Encrypting your note...', 'info');
        
        // Split large content into chunks if needed
        const chunks = [];
        const chunkSize = 10000;
        for (let i = 0; i < noteContent.length; i += chunkSize) {
            chunks.push(noteContent.slice(i, i + chunkSize));
        }
        
        // Encrypt and store all chunks
        const noteIds = [];
        for (let i = 0; i < chunks.length; i++) {
            const { encrypted, key } = encryptNote(chunks[i], password);
            const noteId = storeNote({ 
                encrypted,
                totalChunks: chunks.length,
                chunkIndex: i
            }, expirationTime);
            noteIds.push({ id: noteId, key });
        }
        
        // Generate master link
        const baseUrl = window.location.href.split('#')[0];
        const noteUrl = `${baseUrl}#note=${JSON.stringify(noteIds)}`;
        
        // Clear draft
        localStorage.removeItem('privatnot_draft');
        
        // Show success animation
        await animateTransition();
        
        // Display link
        generatedLink.value = noteUrl;
        createNoteCard.classList.add('d-none');
        linkCard.classList.remove('d-none');
        
        // Auto-focus and select the link
        generatedLink.focus();
        generatedLink.select();
        
        showToast('Note created successfully!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setLoading(submitButton, false);
    }
});

// Animate transition between cards
async function animateTransition() {
    return new Promise(resolve => {
        createNoteCard.style.transition = 'transform 0.3s, opacity 0.3s';
        createNoteCard.style.transform = 'translateX(-100%)';
        createNoteCard.style.opacity = '0';
        
        linkCard.style.transition = 'transform 0.3s, opacity 0.3s';
        linkCard.style.transform = 'translateX(100%)';
        linkCard.style.opacity = '0';
        
        setTimeout(() => {
            linkCard.style.transform = 'translateX(0)';
            linkCard.style.opacity = '1';
            resolve();
        }, 300);
    });
}

// Enhanced toast message
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    
    const icon = {
        success: '<i class="fas fa-check-circle text-success"></i>',
        error: '<i class="fas fa-exclamation-circle text-danger"></i>',
        info: '<i class="fas fa-info-circle text-primary"></i>',
        warning: '<i class="fas fa-exclamation-triangle text-warning"></i>'
    }[type];
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Handle copy button
copyLink.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(generatedLink.value);
        
        // Generate QR code
        const qrCode = await generateQRCode(generatedLink.value);
        
        // Show success message with QR code
        const successAlert = document.createElement('div');
        successAlert.className = 'alert alert-success mt-3';
        successAlert.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <div>
                    <i class="fas fa-check"></i> Link copied to clipboard!
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-success ms-2" onclick="downloadQR()">
                        <i class="fas fa-qrcode"></i> Download QR
                    </button>
                </div>
            </div>
            <div class="text-center mt-2">
                <img src="${qrCode}" alt="QR Code" id="noteQR" style="max-width: 150px;">
            </div>
        `;
        
        linkCard.querySelector('.card-body').appendChild(successAlert);
        
        // Remove success message after 10 seconds
        setTimeout(() => {
            successAlert.remove();
        }, 10000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
});

// Check for note in URL
window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash && hash.includes('note=')) {
        const params = new URLSearchParams(hash.slice(1));
        const noteData = params.get('note');
        
        if (noteData) {
            displayNoteReader(noteData);
        }
    }
});

// Enhanced note reading functionality
async function displayNoteReader(noteData) {
    try {
        const notes = JSON.parse(noteData);
        if (!Array.isArray(notes)) {
            throw new Error('Invalid note format');
        }
        
        // Show password prompt first if note is password protected
        const mainContent = document.querySelector('main .row');
        mainContent.innerHTML = `
            <div class="col-md-8 mx-auto">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Secure Note</h5>
                        <div class="alert alert-info">
                            <i class="fas fa-lock"></i>
                            This note is password protected. Enter the password to view it.
                        </div>
                        <div class="password-form mb-4">
                            <div class="input-group">
                                <input type="password" 
                                       class="form-control" 
                                       id="notePassword" 
                                       placeholder="Enter password"
                                       autocomplete="off">
                                <button class="btn btn-outline-secondary" 
                                        type="button" 
                                        onclick="togglePasswordVisibility()">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <div id="passwordError" class="invalid-feedback" style="display: none;">
                                Incorrect password. Please try again.
                            </div>
                        </div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" onclick="attemptDecryption('${encodeURIComponent(JSON.stringify(notes))}')">
                                <i class="fas fa-unlock"></i> Unlock Note
                            </button>
                            <button class="btn btn-outline-secondary" onclick="window.location.href='/'">
                                <i class="fas fa-arrow-left"></i> Create New Note
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        showError('Failed to load note: ' + error.message);
    }
}

// New function to handle decryption attempt
function attemptDecryption(encodedNotes) {
    try {
        const notes = JSON.parse(decodeURIComponent(encodedNotes));
        decryptNote(notes);
    } catch (error) {
        console.error('Decryption attempt failed:', error);
        showToast('Failed to decrypt note', 'error');
    }
}

// Enhanced decrypt note function
async function decryptNote(notes) {
    const passwordInput = document.getElementById('notePassword');
    const password = passwordInput.value;
    const passwordError = document.getElementById('passwordError');
    
    try {
        // Show loading state
        const mainContent = document.querySelector('main .row .col-md-8');
        mainContent.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="loading-spinner mx-auto mb-3"></div>
                    <p>Decrypting your secure note...</p>
                </div>
            </div>
        `;
        
        // Collect all chunks
        let fullContent = '';
        for (const note of notes) {
            try {
                const noteData = localStorage.getItem(`note_${note.id}`);
                if (!noteData) {
                    throw new Error('Note not found');
                }

                const noteObj = JSON.parse(noteData);
                const combinedKey = password + note.key;
                const decrypted = CryptoJS.AES.decrypt(noteObj.content, combinedKey);
                const content = decrypted.toString(CryptoJS.enc.Utf8);
                
                if (!content) {
                    throw new Error('INVALID_PASSWORD');
                }
                
                fullContent += content;
            } catch (error) {
                console.error('Decryption error:', error);
                throw new Error('INVALID_PASSWORD');
            }
        }
        
        // Display the complete note
        mainContent.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Secure Note</h5>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        This note will be permanently destroyed after closing.
                    </div>
                    <div class="note-content border rounded p-3 mt-3 position-relative">
                        <pre class="mb-0">${escapeHtml(fullContent)}</pre>
                        <button class="copy-button" onclick="copyNoteContent()" title="Copy to clipboard">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="mt-4 text-center">
                        <p class="text-muted small">For security, this note will be destroyed when you close this page.</p>
                        <button class="btn btn-danger" onclick="destroyNote(${JSON.stringify(notes)})">
                            <i class="fas fa-trash"></i> Destroy Note Now
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add close window warning
        window.addEventListener('beforeunload', (e) => {
            e.preventDefault();
            e.returnValue = '';
        });
        
    } catch (error) {
        console.error('Decryption failed:', error);
        
        if (error.message === 'INVALID_PASSWORD') {
            // Show password error
            passwordInput.classList.add('is-invalid');
            passwordError.style.display = 'block';
            passwordError.textContent = 'Incorrect password. Please try again.';
            
            // Reset form
            const mainContent = document.querySelector('main .row .col-md-8');
            mainContent.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Secure Note</h5>
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i>
                            Incorrect password. Please try again.
                        </div>
                        <div class="password-form mb-4">
                            <div class="input-group">
                                <input type="password" 
                                       class="form-control" 
                                       id="notePassword" 
                                       placeholder="Enter password"
                                       autocomplete="off">
                                <button class="btn btn-outline-secondary" 
                                        type="button" 
                                        onclick="togglePasswordVisibility()">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <div id="passwordError" class="invalid-feedback" style="display: block;">
                                Incorrect password. Please try again.
                            </div>
                        </div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" onclick="attemptDecryption('${encodeURIComponent(JSON.stringify(notes))}')">
                                <i class="fas fa-unlock"></i> Unlock Note
                            </button>
                            <button class="btn btn-outline-secondary" onclick="window.location.href='/'">
                                <i class="fas fa-arrow-left"></i> Create New Note
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Show general error
            const mainContent = document.querySelector('main .row .col-md-8');
            mainContent.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Error</h5>
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i>
                            Failed to decrypt note. The note may have expired or been deleted.
                        </div>
                        <div class="text-center mt-3">
                            <a href="/" class="btn btn-primary">
                                <i class="fas fa-plus"></i> Create New Note
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Destroy note immediately
function destroyNote(notes) {
    try {
        // Delete all chunks
        for (const note of notes) {
            localStorage.removeItem(`note_${note.id}`);
        }
        
        // Show destruction confirmation
        const mainContent = document.querySelector('main .row .col-md-8');
        mainContent.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="mb-4">
                        <i class="fas fa-check-circle text-success" style="font-size: 48px;"></i>
                    </div>
                    <h5>Note Destroyed Successfully</h5>
                    <p class="text-muted">The note has been permanently deleted and cannot be recovered.</p>
                    <a href="/" class="btn btn-primary mt-3">
                        <i class="fas fa-plus"></i> Create New Note
                    </a>
                </div>
            </div>
        `;
        
        // Remove URL hash
        window.location.hash = '';
        
        // Remove close window warning
        window.onbeforeunload = null;
        
        // Show success toast
        showToast('Note destroyed successfully', 'success');
    } catch (error) {
        console.error('Error destroying note:', error);
        showToast('Failed to destroy note', 'error');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Copy note content
function copyNoteContent() {
    const content = document.querySelector('.note-content pre').textContent;
    navigator.clipboard.writeText(content)
        .then(() => showToast('Content copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy content', 'error'));
}

// Preview functionality
function previewNote() {
    const noteContent = document.getElementById('noteContent').value;
    const previewContent = document.getElementById('previewContent');
    
    // Convert markdown to HTML (you can add a markdown library for better support)
    const formattedContent = noteContent
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    previewContent.innerHTML = formattedContent;
    
    const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
    previewModal.show();
}

// Format code button
document.getElementById('formatBtn').addEventListener('click', () => {
    const textarea = document.getElementById('noteContent');
    const content = textarea.value;
    
    // Add code block markers
    textarea.value = '```\n' + content + '\n```';
});

// Generate QR code
async function generateQRCode(text) {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
    return qrCodeUrl;
}

// Download QR code
function downloadQR() {
    const qrImage = document.getElementById('noteQR');
    const link = document.createElement('a');
    link.href = qrImage.src;
    link.download = 'privatnot-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Add note templates
const noteTemplates = {
    password: "Benutzername: [benutzername]\nPasswort: [passwort]\nWebseite: [webseite]",
    code: "Sprache: [sprache]\n\n```\n[ihr code hier]\n```",
    contact: "Name: [name]\nE-Mail: [email]\nTelefon: [telefon]\nAdresse: [adresse]"
};

// Add template buttons to the form
const templateButtons = document.createElement('div');
templateButtons.className = 'mb-3';
templateButtons.innerHTML = `
    <label class="form-label">Schnellvorlagen</label>
    <div class="btn-group w-100">
        <button type="button" class="btn btn-outline-secondary" onclick="useTemplate('password')">
            <i class="fas fa-key"></i> Passwort
        </button>
        <button type="button" class="btn btn-outline-secondary" onclick="useTemplate('code')">
            <i class="fas fa-code"></i> Code
        </button>
        <button type="button" class="btn btn-outline-secondary" onclick="useTemplate('contact')">
            <i class="fas fa-address-card"></i> Kontakt
        </button>
    </div>
`;

document.getElementById('noteForm').insertBefore(
    templateButtons,
    document.getElementById('noteContent').parentElement
);

function useTemplate(type) {
    const textarea = document.getElementById('noteContent');
    textarea.value = noteTemplates[type];
    textarea.focus();
}

// Enhanced note statistics with progress bar
function updateNoteStats() {
    // Function removed
}

// Enhanced form validation
function validateNote(content) {
    if (!content.trim()) {
        throw new Error('Note content cannot be empty');
    }
    if (content.length > NOTE_LIMITS.MAX_CHARS) {
        throw new Error(`Note content exceeds maximum length of ${NOTE_LIMITS.MAX_CHARS.toLocaleString()} characters`);
    }
    return true;
}

// Add auto-save functionality
let autoSaveTimeout;
document.getElementById('noteContent').addEventListener('input', () => {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        const content = document.getElementById('noteContent').value;
        if (content) {
            localStorage.setItem('privatnot_draft', content);
            showToast('Draft saved automatically');
        }
    }, 1000);
});

// Check for saved draft on page load
window.addEventListener('load', () => {
    const savedDraft = localStorage.getItem('privatnot_draft');
    if (savedDraft) {
        const textarea = document.getElementById('noteContent');
        textarea.value = savedDraft;
        
        const restoreBar = document.createElement('div');
        restoreBar.className = 'alert alert-info alert-dismissible fade show mt-3';
        restoreBar.innerHTML = `
            <strong>Draft Found!</strong> We've restored your previous note.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.getElementById('createNoteCard').insertBefore(
            restoreBar,
            document.getElementById('noteForm')
        );
    }
});

// Password strength indicator
const passwordInput = document.getElementById('password');
const strengthIndicator = document.createElement('div');
strengthIndicator.className = 'password-strength mt-2';
passwordInput.parentElement.appendChild(strengthIndicator);

passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    let strength = 0;
    let feedback = '';
    
    if (password.length > 0) {
        // Length check
        if (password.length >= 8) strength += 25;
        // Uppercase check
        if (/[A-Z]/.test(password)) strength += 25;
        // Lowercase check
        if (/[a-z]/.test(password)) strength += 25;
        // Numbers/special chars check
        if (/[0-9!@#$%^&*]/.test(password)) strength += 25;
        
        const strengthClass = strength <= 25 ? 'danger' :
                            strength <= 50 ? 'warning' :
                            strength <= 75 ? 'info' : 'success';
        
        feedback = strength <= 25 ? 'Weak' :
                  strength <= 50 ? 'Fair' :
                  strength <= 75 ? 'Good' : 'Strong';
        
        strengthIndicator.innerHTML = `
            <div class="progress" style="height: 5px;">
                <div class="progress-bar bg-${strengthClass}" 
                     style="width: ${strength}%"></div>
            </div>
            <small class="text-${strengthClass} mt-1 d-block">${feedback}</small>
        `;
    } else {
        strengthIndicator.innerHTML = '';
    }
});

// Enhanced template system
const enhancedTemplates = {
    password: {
        icon: 'key',
        name: 'Passwort',
        template: `Webseite: [webseite]
Benutzername: [benutzername]
Passwort: [passwort]
Notizen: [zusätzliche notizen]

Diese Notiz wird nach dem Lesen gelöscht.`
    },
    code: {
        icon: 'code',
        name: 'Code-Snippet',
        template: `Sprache: [sprache]
Beschreibung: [beschreibung]

\`\`\`
[ihr code hier]
\`\`\`

Zusätzliche Notizen: [notizen]`
    },
    contact: {
        icon: 'address-card',
        name: 'Kontakt',
        template: `Name: [name]
E-Mail: [email]
Telefon: [telefon]
Adresse: [adresse]

Zusätzliche Informationen:
[weitere informationen]`
    },
    message: {
        icon: 'envelope',
        name: 'Sichere Nachricht',
        template: `Betreff: [betreff]

[ihre nachricht hier]

---
Dies ist eine sichere, selbstzerstörende Nachricht.`
    }
};

// Update template buttons
templateButtons.innerHTML = `
    <label class="form-label">Schnellvorlagen</label>
    <div class="btn-group w-100">
        ${Object.entries(enhancedTemplates).map(([key, template]) => `
            <button type="button" class="btn btn-outline-secondary" onclick="useTemplate('${key}')">
                <i class="fas fa-${template.icon}"></i>
                ${template.name}
            </button>
        `).join('')}
    </div>
`;

// Enhanced template usage
function useTemplate(type) {
    const textarea = document.getElementById('noteContent');
    textarea.value = enhancedTemplates[type].template;
    textarea.focus();
    
    // Animate the template insertion
    textarea.style.transition = 'transform 0.2s';
    textarea.style.transform = 'scale(1.02)';
    setTimeout(() => {
        textarea.style.transform = 'scale(1)';
    }, 200);
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!document.getElementById('noteForm').classList.contains('d-none')) {
            document.querySelector('button[type="submit"]').click();
        }
    }
    
    // Ctrl/Cmd + D to toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        darkModeToggle.click();
    }
});

// Add help tooltip for keyboard shortcuts
const helpTooltip = document.createElement('div');
helpTooltip.className = 'position-fixed bottom-0 end-0 m-3 no-print';
helpTooltip.innerHTML = `
    <button class="btn btn-outline-secondary btn-sm" 
            data-bs-toggle="tooltip" 
            data-bs-placement="left"
            title="Keyboard Shortcuts:
            Ctrl/Cmd + Enter: Submit Note
            Ctrl/Cmd + D: Toggle Dark Mode">
        <i class="fas fa-keyboard"></i>
    </button>
`;
document.body.appendChild(helpTooltip);

// Initialize tooltips
const tooltips = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltips.map(tooltip => new bootstrap.Tooltip(tooltip));

// Header scroll effect
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    // Add/remove scrolled class
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Add this to your existing js/main.js file or create a new one
function toggleLanguages() {
    const dropdown = document.getElementById('languageDropdown');
    dropdown.classList.toggle('show');
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('.language-selector')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

function changeLanguage(lang) {
    // Here you can implement the language change logic
    // For example, using a translation service or switching to a different version of the site
    console.log(`Changing language to: ${lang}`);
    
    // Close the dropdown
    document.getElementById('languageDropdown').classList.remove('show');
    
    // Prevent default link behavior
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize note destruction functionality
    const noteDestruction = new NoteDestruction();

    // Note creation form
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Show loading state
            const submitButton = noteForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating Note...';
            submitButton.disabled = true;

            try {
                // Get form values
                const noteContent = document.getElementById('noteContent').value;
                const expirationTime = document.getElementById('expirationTime').value;
                const password = document.getElementById('password').value;

                // Convert expiration time to minutes
                let destructionTime;
                switch (expirationTime) {
                    case '5':
                        destructionTime = 5;
                        break;
                    case '60':
                        destructionTime = 60;
                        break;
                    case '1440':
                        destructionTime = 1440;
                        break;
                    case 'read':
                        destructionTime = null;
                        break;
                    default:
                        destructionTime = 5;
                }

                // Initialize note with destruction settings
                const noteLink = noteDestruction.initializeNote(
                    noteContent,
                    destructionTime,
                    expirationTime === 'read' // autoDestroy if set to "after reading"
                );

                // Show the generated link
                const linkCard = document.getElementById('linkCard');
                const generatedLink = document.getElementById('generatedLink');
                if (linkCard && generatedLink) {
                    generatedLink.value = noteLink;
                    linkCard.classList.remove('d-none');

                    // Scroll to link card
                    linkCard.scrollIntoView({ behavior: 'smooth' });
                }

                // Setup copy button
                const copyButton = document.getElementById('copyLink');
                if (copyButton) {
                    copyButton.addEventListener('click', () => {
                        generatedLink.select();
                        document.execCommand('copy');
                        
                        // Show copy confirmation
                        const originalCopyText = copyButton.innerHTML;
                        copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                        setTimeout(() => {
                            copyButton.innerHTML = originalCopyText;
                        }, 2000);
                    });
                }

                // Clear form
                noteForm.reset();

            } catch (error) {
                console.error('Error creating note:', error);
                
                // Show error message
                const errorAlert = document.createElement('div');
                errorAlert.className = 'alert alert-danger mt-3';
                errorAlert.innerHTML = `
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error creating note. Please try again.
                `;
                noteForm.appendChild(errorAlert);

                // Remove error message after 5 seconds
                setTimeout(() => {
                    errorAlert.remove();
                }, 5000);
            } finally {
                // Restore button state
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }

    // Format code button
    const formatBtn = document.getElementById('formatBtn');
    if (formatBtn) {
        formatBtn.addEventListener('click', () => {
            const noteContent = document.getElementById('noteContent');
            if (noteContent) {
                // Add code formatting (you can customize this based on your needs)
                noteContent.value = '```\n' + noteContent.value + '\n```';
            }
        });
    }

    // Preview functionality
    window.previewNote = () => {
        const noteContent = document.getElementById('noteContent').value;
        const previewContent = document.getElementById('previewContent');
        
        if (previewContent) {
            // Basic markdown-like formatting (you can enhance this)
            let formattedContent = noteContent
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/\n/g, '<br>');
            
            previewContent.innerHTML = formattedContent;
            
            // Show preview modal
            const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
            previewModal.show();
        }
    };
}); 