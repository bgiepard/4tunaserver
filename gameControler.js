
class GameController {
    constructor() {
        // Initialize phrases and vowels
        this.initialPhrases = [
            'Z małej chmury duży deszcz',
            'Co nagle to po diable',
            'Lepszy wróbel w garści',
            'Kto pyta nie błądzi',
            'Czas leczy rany',
            'Bez pracy nie ma kołaczy',
            'Prawda w oczy kole',
            'Kto pod kim dołki kopie',
        ];

        this.vowels = ['A', 'E', 'I', 'O', 'U', 'Y', 'Ą', 'Ę', 'Ó'];

        // Copy initial phrases to the phrases array
        this.phrases = [...this.initialPhrases];

        // Initialize game information
        this.gameInfo = {
            stake: 0,
            players: [], // Players will be added when they join the game
            round: 1,
            maxRounds: 3,
            currentPlayer: 0,
            badLetters: [],
            goodLetters: [],
            phrase: this.getRandomPhrase(),
            category: 'Przysłowia',
            currentLetter: '',
            rotate: 0,
            mode: 'rotating', // Modes: guessing, rotating, onlyVowels, letter
            rotating: false,
            goodGuess: true,
            onlyVowels: false,
        };
    }

    // Method to get a random phrase
    getRandomPhrase() {
        const randomIndex = Math.floor(Math.random() * this.phrases.length);
        return this.phrases[randomIndex];
    }

    // Method to add points to the current player
    addPoints(letterCount) {
        const currentPlayer = this.gameInfo.players[this.gameInfo.currentPlayer];
        currentPlayer.amount += this.gameInfo.stake * letterCount;
    }

    // Method to move to the next player
    nextPlayer() {
        this.gameInfo.mode = 'rotating';
        this.gameInfo.currentPlayer = (this.gameInfo.currentPlayer + 1) % this.gameInfo.players.length;
    }

    // Method to reset points for the current player
    resetPoints() {
        const currentPlayer = this.gameInfo.players[this.gameInfo.currentPlayer];
        currentPlayer.amount = 0;
        this.nextPlayer();
    }

    // Method to reset half the points for the current player
    resetHalf() {
        const currentPlayer = this.gameInfo.players[this.gameInfo.currentPlayer];
        currentPlayer.amount = currentPlayer.amount > 0 ? currentPlayer.amount / 2 : 0;
        this.nextPlayer();
    }

    // Method to simulate rotating the wheel
    rotateWheel() {
        this.gameInfo.rotate = Math.floor(Math.random() * (721 - 360)) + 180;
        this.gameInfo.stake = Math.floor(Math.random() * (1000 - 100)) + 100;
    }

    // Method to set the game mode to guessing
    letMeGuess() {
        this.gameInfo.mode = 'guessing';
    }

    // Method to handle letter clicks
    letterClick(letter) {
        const upperLetter = letter.toUpperCase();
        const upperPhrase = this.gameInfo.phrase.toUpperCase();

        if (this.gameInfo.mode === 'guessing') {
            if (upperPhrase.includes(upperLetter)) {
                this.gameInfo.goodLetters = [...new Set([...this.gameInfo.goodLetters, upperLetter])];

                const allLettersInPhrase = new Set(upperPhrase.replace(/\s/g, '').split(''));
                const guessedAllLetters = [...allLettersInPhrase].every((char) => this.gameInfo.goodLetters.includes(char));

                if (guessedAllLetters) {
                    const currentPlayerIndex = this.gameInfo.currentPlayer;
                    this.gameInfo.players = this.gameInfo.players.map((player, index) => {
                        if (index === currentPlayerIndex) {
                            return {
                                ...player,
                                total: player.total + player.amount,
                                amount: 0,
                            };
                        } else {
                            return { ...player, amount: 0 };
                        }
                    });

                    this.phrases = this.phrases.filter((phrase) => phrase !== this.gameInfo.phrase);

                    if (this.phrases.length === 0) {
                        this.phrases = [...this.initialPhrases];
                    }

                    const newPhrase = this.getRandomPhrase();

                    this.gameInfo = {
                        ...this.gameInfo,
                        players: this.gameInfo.players,
                        goodLetters: [],
                        badLetters: [],
                        currentLetter: '',
                        phrase: newPhrase,
                        category: 'Przysłowia',
                        round: this.gameInfo.round + 1,
                        onlyVowels: false,
                        currentPlayer: (currentPlayerIndex + 1) % this.gameInfo.players.length,
                        mode: 'rotating',
                        rotate: 0,
                    };
                }
            } else {
                this.resetPoints();
                this.gameInfo.mode = 'rotating';
            }
        } else {
            const letterCount = upperPhrase.split('').filter((char) => char === upperLetter).length;
            const isCorrectLetter = letterCount > 0;

            if (isCorrectLetter) {
                this.addPoints(letterCount);
                this.gameInfo.goodLetters = [...new Set([...this.gameInfo.goodLetters, upperLetter])];
            } else {
                this.gameInfo.badLetters = [...new Set([...this.gameInfo.badLetters, upperLetter])];
            }

            const allLettersInPhrase = new Set(upperPhrase.replace(/\s/g, '').split(''));
            const unguessedLetters = [...allLettersInPhrase].filter((char) => !this.gameInfo.goodLetters.includes(char));

            const onlyVowelsLeft = unguessedLetters.every((char) => this.vowels.includes(char));

            if (onlyVowelsLeft) {
                this.gameInfo.onlyVowels = true;
            }

            this.gameInfo.currentLetter = upperLetter;
            this.gameInfo.goodGuess = isCorrectLetter;

            if (!isCorrectLetter) {
                this.nextPlayer();
                this.gameInfo.mode = 'rotating';
            }
        }
    }
}

module.exports = GameController;
