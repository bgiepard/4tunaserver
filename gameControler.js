const { initialPhrases, vowels, values } = require("./utils/constants");

class GameController {
  constructor(players, maxRounds, id) {
    this.initialPhrases = [...initialPhrases];
    this.vowels = [...vowels];
    this.values = [...values];

    this.phrases = [...this.initialPhrases];
    this.usedPhrases = [];

    // Pobierz losową frazę i jej kategorię
    const { phrase, category } = this.getRandomPhrase();

    // Initialize game information with provided players
    this.gameInfo = {
      gameID: id,
      stake: 0,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        amount: 0,
        total: 0,
      })),
      round: 1,
      maxRounds: maxRounds || 3, // Use provided maxRounds or default to 3
      currentPlayer: 0,
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
    const currentPlayer = this.gameInfo.players[this.gameInfo.currentPlayer];
    currentPlayer.amount += this.gameInfo.stake * letterCount;
  }

  // Method to move to the next player
  nextPlayer() {
    this.gameInfo.mode = "rotating";
    this.gameInfo.currentPlayer =
      (this.gameInfo.currentPlayer + 1) % this.gameInfo.players.length;
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

  // Method to set the game mode to guessing
  letMeGuess() {
    this.gameInfo.mode = "guessing";
  }

  // Method to handle letter clicks
  letterClick(letter) {
    const upperLetter = letter.toUpperCase();
    const upperPhrase = this.gameInfo.phrase.toUpperCase();

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

          // Usuń używaną frazę na podstawie właściwości `phrase`
          this.usedPhrases = this.usedPhrases.filter(
            (p) => p.phrase !== this.gameInfo.phrase,
          );

          // Jeśli nie ma fraz dostępnych, zresetuj do initialPhrases
          if (this.phrases.length === 0) {
            this.phrases = [...this.initialPhrases];
            this.usedPhrases = [];
          }

          // Wybierz nową frazę
          const { phrase, category } = this.getRandomPhrase();

          this.gameInfo = {
            ...this.gameInfo,
            players: this.gameInfo.players,
            goodLetters: [],
            badLetters: [],
            currentLetter: "",
            phrase: phrase, // Ustaw nową frazę
            category: category, // Ustaw nową kategorię
            round: this.gameInfo.round + 1,
            onlyVowels: false,
            currentPlayer:
              (currentPlayerIndex + 1) % this.gameInfo.players.length,
            mode: "rotating",
            rotate: 0,
            afterRotate: false, // Reset if needed
          };
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
      } else {
        this.gameInfo.badLetters = [
          ...new Set([...this.gameInfo.badLetters, upperLetter]),
        ];
      }

      const allLettersInPhrase = new Set(
        upperPhrase.replace(/\s/g, "").split(""),
      );
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
      this.gameInfo.goodGuess = isCorrectLetter;

      if (!isCorrectLetter) {
        this.nextPlayer();
        this.gameInfo.mode = "rotating";
      } else {
        this.gameInfo.mode = "rotating"; // Assuming mode switches back to rotating after a correct guess
      }
    }
  }

  // Method to get game current state
  getGameState() {
    return this.gameInfo;
  }
}

module.exports = GameController;
