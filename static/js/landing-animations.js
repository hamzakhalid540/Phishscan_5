// Landing page animations
document.addEventListener('DOMContentLoaded', function() {
    // Typing animation
    const phrases = [
        'Phishing URLs',
        'Malicious Websites',
        'Cyber Threats',
        'Online Scams'
    ];
    
    let currentPhrase = 0;
    let currentLetter = 0;
    let deleting = false;
    const typingElement = document.querySelector('.typing-animation');
    const cursor = '|';
    
    function type() {
        const fullPhrase = phrases[currentPhrase];
        
        if (!deleting && currentLetter < fullPhrase.length) {
            typingElement.textContent = fullPhrase.substring(0, currentLetter + 1) + cursor;
            currentLetter++;
            setTimeout(type, 100);
        } else if (!deleting && currentLetter === fullPhrase.length) {
            deleting = true;
            setTimeout(type, 1500);
        } else if (deleting && currentLetter > 0) {
            typingElement.textContent = fullPhrase.substring(0, currentLetter - 1) + cursor;
            currentLetter--;
            setTimeout(type, 50);
        } else {
            deleting = false;
            currentPhrase = (currentPhrase + 1) % phrases.length;
            setTimeout(type, 500);
        }
    }
    
    // Start typing animation
    type();
    
    // Animate feature items on scroll
    const featureItems = document.querySelectorAll('.feature-item');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = 1;
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.2 });
    
    featureItems.forEach(item => {
        item.style.opacity = 0;
        item.style.transform = 'translateY(50px)';
        item.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        observer.observe(item);
    });
    
    // Button hover animations
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            anime({
                targets: this,
                scale: 1.05,
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
        
        button.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                scale: 1,
                duration: 300,
                easing: 'easeOutQuad'
            });
        });
    });
});