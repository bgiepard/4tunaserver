const { initialPhrases, vowels, values } = require("./utils/constants");

class GameController {
  constructor(players, maxRounds, id) {
    this.initialPhrases = [...initialPhrases];
    this.vowels = [...vowels];
    this.values = [...values];

    this.phrases = [...this.initialPhrases];
    this.usedPhrases = [];

    const { phrase, category } = this.getRandomPhrase();
    const randomPlayerIndex = Math.floor(Math.random() * players.length);

    // Initialize game information with provided players
    this.gameInfo = {
      gameID: id,
      stake: 0,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        amount: 0,
        total: 0,
        connected: p.connected !== undefined ? p.connected : true,
      })),
      solo: players.length === 1,
      round: 1,
      maxRounds: maxRounds || 3, // Use provided maxRounds or default to 3
      currentPlayer: randomPlayerIndex,
      badLetters: [],
      goodLetters: [],
      phrase: phrase, // Ustaw frazę jako string
      category: category, // Ustaw kategorię
      currentLetter: "",
      rotate: 0,
      mode: "rotating", // Modes: guessing, rotating, onlyVowels, letter
      rotating: false,
      goodGuess: true,
      onlyVowels: false,
      afterRotate: false, // Mirrors the React context
      totalRotate: 0,
      vowels: this.vowels,
      hasRotated: false,
    };
  }

  // Method to get a random phrase
  getRandomPhrase() {
    if (this.phrases.length === 0) {
      throw new Error("No more unique phrases available.");
    }

    // Wybierz losowy indeks
    const randomIndex = Math.floor(Math.random() * this.phrases.length);
    const selectedPhraseObj = this.phrases[randomIndex];

    // Przenieś wybraną frazę do usedPhrases
    this.usedPhrases.push(selectedPhraseObj);
    this.phrases.splice(randomIndex, 1); // Usuń z dostępnych fraz

    // Zwróć cały obiekt frazy
    return {
      phrase: selectedPhraseObj.phrase,
      category: selectedPhraseObj.category,
    };
  }

  // Method to add points to the current player
  addPoints(letterCount) {
    if (this.gameInfo.currentPlayer >= 0) {
      const currentPlayer = this.gameInfo.players[this.gameInfo.currentPlayer];
      currentPlayer.amount += this.gameInfo.stake * letterCount;
    }
  }

  // Method to move to the next player
  // In GameController.js
  nextPlayer() {
    if (this.gameInfo.players.length === 1) {
      // Solo play: reset necessary variables and continue
      this.gameInfo.mode = "rotating";
      this.gameInfo.hasRotated = false;
      return;
    }

    this.gameInfo.mode = "rotating";
    const totalPlayers = this.gameInfo.players.length;
    let attempts = 0;
    let foundConnectedPlayer = false;

    do {
      this.gameInfo.currentPlayer =
        (this.gameInfo.currentPlayer + 1) % totalPlayers;
      attempts++;
      if (this.gameInfo.players[this.gameInfo.currentPlayer].connected) {
        foundConnectedPlayer = true;
        break;
      }
    } while (attempts < totalPlayers);

    if (!foundConnectedPlayer) {
      this.gameInfo.mode = "gameover";
      this.gameInfo.currentPlayer = -1; // Invalid index to indicate no current player
    }
    this.gameInfo.hasRotated = false;
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
    currentPlayer.amount =
      currentPlayer.amount > 0 ? currentPlayer.amount / 2 : 0;
    this.nextPlayer();
  }

  // Method to simulate rotating the wheel
  rotateWheel() {
    const incrementalRotate = Math.floor(Math.random() * (720 - 180 + 1)) + 180;
    this.gameInfo.rotate = incrementalRotate;
    this.gameInfo.totalRotate += incrementalRotate;
    this.gameInfo.hasRotated = true;
  }

  // Method to reset the stake
  resetStake() {
    this.gameInfo.stake = 0;
  }

  // Method to determine the selected value based on rotation angle
  determineSelectedValue() {
    const rotationAngle = this.gameInfo.totalRotate;
    let adjustedAngle = ((rotationAngle % 360) + 360) % 360; // Normalize to 0-359
    const sliceAngle = 360 / this.values.length; // 22.5 degrees per slice for 16 slices
    const arrowAngle = 0; // Assuming the arrow points to 0 degrees
    let angleAtArrow = (adjustedAngle + arrowAngle) % 360;
    const sliceIndex =
      Math.floor(angleAtArrow / sliceAngle) % this.values.length;
    return this.values[sliceIndex];
  }

  // Method to process the selected value after rotation
  processSelectedValue(selectedValue) {
    this.gameInfo.selectedValue = selectedValue;

    if (selectedValue == "-100%") {
      this.gameInfo.stake = selectedValue;
      this.gameInfo.mode = "letter";
      this.resetPoints();
    } else if (selectedValue == "STOP") {
      this.gameInfo.stake = selectedValue;
      this.gameInfo.mode = "letter";
      this.nextPlayer();
    } else {
      this.gameInfo.stake = selectedValue;
      this.gameInfo.mode = "letter";
      this.gameInfo.goodGuess = false;
      this.gameInfo.afterRotate = true;
    }
  }

  handleRoundWin() {
    const currentPlayerIndex = this.gameInfo.currentPlayer;
    if (currentPlayerIndex < 0) return;

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

    // Remove used phrase
    this.usedPhrases = this.usedPhrases.filter(
      (p) => p.phrase !== this.gameInfo.phrase,
    );

    // If no phrases available, reset to initialPhrases
    if (this.phrases.length === 0) {
      this.phrases = [...this.initialPhrases];
      this.usedPhrases = [];
    }

    // Choose a new phrase
    const { phrase, category } = this.getRandomPhrase();

    // Reset game state
    this.gameInfo.goodLetters = [];
    this.gameInfo.badLetters = [];
    this.gameInfo.currentLetter = "";
    this.gameInfo.phrase = phrase;
    this.gameInfo.category = category;
    this.gameInfo.round += 1;
    this.gameInfo.onlyVowels = false;
    this.gameInfo.currentPlayer =
      (currentPlayerIndex + 1) % this.gameInfo.players.length;
    this.gameInfo.mode = "rotating";
    this.gameInfo.rotate = 0;
    this.gameInfo.afterRotate = false;
    this.gameInfo.totalRotate = 0;
    this.gameInfo.hasRotated = false;
  }

  // Method to set the game mode to guessing
  letMeGuess() {
    this.gameInfo.mode = "guessing";
  }

  // Method to handle letter clicks
  letterClick(letter) {
    const upperLetter = letter.toUpperCase();
    const upperPhrase = this.gameInfo.phrase.toUpperCase();
    let phraseGuessed = false;

    if (this.gameInfo.mode === "guessing") {
      if (upperPhrase.includes(upperLetter)) {
        this.gameInfo.goodLetters = [
          ...new Set([...this.gameInfo.goodLetters, upperLetter]),
        ];

        const allLettersInPhrase = new Set(
          upperPhrase.replace(/\s/g, "").split(""),
        );
        const guessedAllLetters = [...allLettersInPhrase].every((char) =>
          this.gameInfo.goodLetters.includes(char),
        );

        if (guessedAllLetters) {
          this.handleRoundWin();
          phraseGuessed = true;
        }
      } else {
        this.resetPoints();
        this.gameInfo.mode = "rotating";
      }
    } else {
      const letterCount = upperPhrase
        .split("")
        .filter((char) => char === upperLetter).length;
      const isCorrectLetter = letterCount > 0;

      if (isCorrectLetter) {
        this.addPoints(letterCount);
        this.gameInfo.goodLetters = [
          ...new Set([...this.gameInfo.goodLetters, upperLetter]),
        ];

        // Check if all letters have been guessed
        const allLettersInPhrase = new Set(
          upperPhrase.replace(/\s/g, "").split(""),
        );
        const guessedAllLetters = [...allLettersInPhrase].every((char) =>
          this.gameInfo.goodLetters.includes(char),
        );

        if (guessedAllLetters) {
          this.handleRoundWin();
          phraseGuessed = true;
        } else {
          // Not all letters guessed
          const unguessedLetters = [...allLettersInPhrase].filter(
            (char) => !this.gameInfo.goodLetters.includes(char),
          );

          const onlyVowelsLeft = unguessedLetters.every((char) =>
            this.vowels.includes(char),
          );

          if (onlyVowelsLeft) {
            this.gameInfo.onlyVowels = true;
          }

          this.gameInfo.currentLetter = upperLetter;
          this.gameInfo.goodGuess = true;
          this.gameInfo.mode = "rotating";
        }
      } else {
        this.gameInfo.badLetters = [
          ...new Set([...this.gameInfo.badLetters, upperLetter]),
        ];
        this.nextPlayer();
        this.gameInfo.mode = "rotating";
        this.gameInfo.goodGuess = false;
      }
    }

    return phraseGuessed;
  }

  // Method to get game current state
  getGameState() {
    return this.gameInfo;
  }
}

module.exports = GameController;
