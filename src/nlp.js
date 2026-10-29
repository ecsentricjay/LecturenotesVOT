/**
 * @file src/nlp.js
 * Pure JavaScript NLP pipeline for lecture transcript topic segmentation,
 * keyword extraction, and extractive summarization.
 * No external machine-learning models or network downloads.
 */

/**
 * Cosine similarity threshold for detecting a topic boundary between
 * sliding windows of sentences. Drops below this threshold indicate a potential shift.
 */
export const SIMILARITY_THRESHOLD = 0.18;

// Common English stopwords plus frequent conversational lecture filler words
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t',
  'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll',
  'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more',
  'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t',
  'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while',
  'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would',
  'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your',
  'yours', 'yourself', 'yourselves',
  // Conversational academic filler words:
  'okay', 'ok', 'right', 'so', 'well', 'like', 'um', 'uh', 'now', 'going',
  'talk', 'talking', 'lecture', 'class', 'today', 'let', 'see', 'look',
  'mean', 'know', 'think', 'actually', 'basically', 'really', 'also', 'just'
]);

/**
 * Common abbreviations that end in a period but do not terminate a sentence.
 */
const ABBREVIATIONS = [
  'dr', 'prof', 'mr', 'mrs', 'ms', 'e.g', 'i.e', 'vs', 'etc', 'fig', 'al',
  'approx', 'dept', 'univ', 'no', 'vol', 'sec', 'inc', 'ltd', 'co', 'est'
];

/**
 * 1. Splits raw transcript into clean sentences while respecting abbreviations,
 * numbers with decimals, and punctuation.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];

  // Temporarily mask periods in common abbreviations
  let sanitized = text.trim();
  ABBREVIATIONS.forEach((abbr) => {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
    sanitized = sanitized.replace(regex, (match) => match.replace('.', '___DOT___'));
  });

  // Mask decimal numbers (e.g. 3.14 or 0.05)
  sanitized = sanitized.replace(/(\d+)\.(\d+)/g, '$1___DECIMAL___$2');

  // Split on sentence-ending punctuation followed by whitespace or line break
  const rawSentences = sanitized.split(/(?<=[.?!])\s+(?=[A-Z0-9"']|$)/);

  const sentences = [];
  for (let s of rawSentences) {
    // Restore masked dots and decimals
    let restored = s
      .replace(/___DOT___/g, '.')
      .replace(/___DECIMAL___/g, '.')
      .trim();

    // Ensure sentence has substance (at least 3 characters and some alphabetic text)
    if (restored.length > 5 && /[a-zA-Z]/.test(restored)) {
      // Ensure it ends with punctuation if it got chopped
      if (!/[.?!]$/.test(restored)) {
        restored += '.';
      }
      sentences.push(restored);
    }
  }

  return sentences;
}

/**
 * Tokenizes text into lowercase unigrams (length >= 3, non-stopwords)
 * and valid bigrams.
 * @param {string} text
 * @returns {{ unigrams: string[], bigrams: string[] }}
 */
function tokenize(text) {
  const cleanWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const unigrams = cleanWords.filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const bigrams = [];

  for (let i = 0; i < cleanWords.length - 1; i++) {
    const w1 = cleanWords[i];
    const w2 = cleanWords[i + 1];
    if (!STOPWORDS.has(w1) && !STOPWORDS.has(w2) && w1.length >= 3 && w2.length >= 3) {
      bigrams.push(`${w1} ${w2}`);
    }
  }

  return { unigrams, bigrams };
}

/**
 * 2. Builds global IDF table and individual TF-IDF vectors for sentences.
 * @param {string[]} sentences
 * @returns {{ idf: Map<string, number>, vectors: Map<string, number>[] }}
 */
export function buildTfIdf(sentences) {
  const N = sentences.length;
  const sentenceTokens = sentences.map((s) => {
    const { unigrams, bigrams } = tokenize(s);
    return [...unigrams, ...bigrams];
  });

  // Calculate Document Frequency (DF) for each term
  const df = new Map();
  sentenceTokens.forEach((tokens) => {
    const uniqueTerms = new Set(tokens);
    uniqueTerms.forEach((term) => {
      df.set(term, (df.get(term) || 0) + 1);
    });
  });

  // Calculate Inverse Document Frequency (IDF)
  const idf = new Map();
  df.forEach((count, term) => {
    // Smoothed IDF formula
    const score = Math.log((N + 1) / (count + 1)) + 1;
    idf.set(term, score);
  });

  // Calculate normalized TF-IDF vector for each sentence
  const vectors = sentenceTokens.map((tokens) => {
    const tf = new Map();
    tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));

    const vec = new Map();
    let normSq = 0;
    tf.forEach((count, term) => {
      const tfScore = Math.sqrt(count); // sublinear scaling
      const idfScore = idf.get(term) || 1;
      const weight = tfScore * idfScore;
      vec.set(term, weight);
      normSq += weight * weight;
    });

    const norm = Math.sqrt(normSq) || 1;
    const normalizedVec = new Map();
    vec.forEach((weight, term) => {
      normalizedVec.set(term, weight / norm);
    });

    return normalizedVec;
  });

  return { idf, vectors };
}

/**
 * Calculates cosine similarity between two normalized TF-IDF vectors.
 * @param {Map<string, number>} vecA
 * @param {Map<string, number>} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0;
  let dotProduct = 0;
  // Iterate over smaller vector for performance
  const [smaller, larger] = vecA.size < vecB.size ? [vecA, vecB] : [vecB, vecA];
  smaller.forEach((val, key) => {
    if (larger.has(key)) {
      dotProduct += val * larger.get(key);
    }
  });
  return dotProduct;
}

/**
 * Aggregates multiple normalized sentence vectors into a single normalized window vector.
 * @param {Map<string, number>[]} vectors
 * @param {number} startIdx
 * @param {number} endIdx
 * @returns {Map<string, number>}
 */
function aggregateWindowVector(vectors, startIdx, endIdx) {
  const sumVec = new Map();
  for (let i = startIdx; i <= endIdx; i++) {
    const v = vectors[i];
    if (!v) continue;
    v.forEach((val, term) => {
      sumVec.set(term, (sumVec.get(term) || 0) + val);
    });
  }

  let normSq = 0;
  sumVec.forEach((val) => {
    normSq += val * val;
  });
  const norm = Math.sqrt(normSq) || 1;
  const normalized = new Map();
  sumVec.forEach((val, term) => {
    normalized.set(term, val / norm);
  });
  return normalized;
}

/**
 * 3. Topic Segmentation:
 * Compares cosine similarity between sliding windows of 3 sentences.
 * Identifies boundaries where similarity drops below SIMILARITY_THRESHOLD.
 * Enforces: at least 4 sentences per segment, at most 6 segments total.
 *
 * @param {string[]} sentences
 * @param {Map<string, number>[]} vectors
 * @returns {number[][]} Array of sentence indices per segment
 */
export function segmentSentences(sentences, vectors) {
  const n = sentences.length;
  // Edge cases: tiny transcript
  if (n <= 5) {
    return [sentences.map((_, i) => i)];
  }

  const windowSize = 3;
  const MIN_SENTENCES_PER_SEGMENT = 4;
  const MAX_SEGMENTS = 6;

  // Compute similarities at candidate boundaries (where i is boundary index)
  // Window Left: [i - windowSize, i - 1], Window Right: [i, i + windowSize - 1]
  const boundaryScores = [];

  for (let i = windowSize; i <= n - windowSize; i++) {
    const leftVec = aggregateWindowVector(vectors, i - windowSize, i - 1);
    const rightVec = aggregateWindowVector(vectors, i, i + windowSize - 1);
    const sim = cosineSimilarity(leftVec, rightVec);
    boundaryScores.push({ index: i, similarity: sim });
  }

  // Sort candidate boundaries by lowest similarity (greatest topic divergence)
  boundaryScores.sort((a, b) => a.similarity - b.similarity);

  const selectedBoundaries = [];

  for (const candidate of boundaryScores) {
    // Must be below threshold OR if we have very few boundaries on a long text
    const isDip = candidate.similarity < SIMILARITY_THRESHOLD || selectedBoundaries.length === 0;

    if (!isDip && selectedBoundaries.length >= 2) {
      continue;
    }

    // Check distance constraint: at least MIN_SENTENCES_PER_SEGMENT from start, end, and existing boundaries
    const candidateIdx = candidate.index;
    const isFarFromStart = candidateIdx >= MIN_SENTENCES_PER_SEGMENT;
    const isFarFromEnd = n - candidateIdx >= MIN_SENTENCES_PER_SEGMENT;
    const isFarFromOthers = selectedBoundaries.every(
      (b) => Math.abs(b - candidateIdx) >= MIN_SENTENCES_PER_SEGMENT
    );

    if (isFarFromStart && isFarFromEnd && isFarFromOthers) {
      selectedBoundaries.push(candidateIdx);
      if (selectedBoundaries.length >= MAX_SEGMENTS - 1) {
        break;
      }
    }
  }

  // If no boundaries met strict criteria and text is long (e.g. >= 12 sentences),
  // place balanced fallback boundaries so user still gets structured topics
  if (selectedBoundaries.length === 0 && n >= 8) {
    const targetSegments = Math.min(MAX_SEGMENTS, Math.max(2, Math.floor(n / 6)));
    const step = Math.floor(n / targetSegments);
    for (let s = 1; s < targetSegments; s++) {
      selectedBoundaries.push(s * step);
    }
  }

  // Sort boundaries ascending
  selectedBoundaries.sort((a, b) => a - b);

  // Form segments
  const segments = [];
  let prev = 0;
  for (const b of selectedBoundaries) {
    const segIndices = [];
    for (let i = prev; i < b; i++) segIndices.push(i);
    segments.push(segIndices);
    prev = b;
  }
  const lastSeg = [];
  for (let i = prev; i < n; i++) lastSeg.push(i);
  segments.push(lastSeg);

  return segments;
}

/**
 * 4. Extracts top 5 keywords (unigrams and bigrams) for a segment.
 * @param {string[]} segmentSentences
 * @param {Map<string, number>} globalIdf
 * @returns {string[]}
 */
export function extractKeywords(segmentSentences, globalIdf) {
  const termCounts = new Map();

  segmentSentences.forEach((s) => {
    const { unigrams, bigrams } = tokenize(s);
    unigrams.forEach((u) => termCounts.set(u, (termCounts.get(u) || 0) + 1));
    bigrams.forEach((b) => termCounts.set(b, (termCounts.get(b) || 0) + 1.5)); // boost bigrams
  });

  const conversationalStarters = new Set([
    'however', 'welcome', 'everyone', 'today', 'let', 'look', 'talk',
    'basically', 'actually', 'mean', 'next', 'week', 'first', 'second'
  ]);

  const scored = [];
  termCounts.forEach((count, term) => {
    const idfVal = globalIdf.get(term) || 1.2;
    // Prefer multi-word phrases and domain-rich terms
    const isBigram = term.includes(' ');
    const lengthBonus = isBigram ? 1.4 : 1.0;
    // Penalize terms that start with conversational transition words
    const firstWord = term.split(' ')[0];
    const penalty = conversationalStarters.has(firstWord) ? 0.3 : 1.0;
    const score = count * idfVal * lengthBonus * penalty;
    scored.push({ term, score });
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top 5 unique terms
  return scored.slice(0, 5).map((item) => item.term);
}

/**
 * 5. Centrality-based extractive summarization:
 * Ranks sentences by mean cosine similarity to all other sentences in the segment,
 * picks top 3 to 5, and preserves their original chronological order.
 *
 * @param {string[]} segmentSentences
 * @param {Map<string, number>[]} segmentVectors
 * @returns {string[]}
 */
export function extractBullets(segmentSentences, segmentVectors) {
  const m = segmentSentences.length;
  if (m <= 3) {
    return [...segmentSentences];
  }

  // Determine target bullets: between 3 and 5
  const targetCount = Math.min(5, Math.max(3, Math.ceil(m * 0.4)));

  // Calculate centrality score for each sentence
  const scoredSentences = segmentSentences.map((sentence, idx) => {
    const vecA = segmentVectors[idx];
    let simSum = 0;
    for (let j = 0; j < m; j++) {
      if (idx !== j) {
        simSum += cosineSimilarity(vecA, segmentVectors[j]);
      }
    }
    const centrality = m > 1 ? simSum / (m - 1) : 1;
    return { sentence, idx, centrality };
  });

  // Rank by centrality descending
  scoredSentences.sort((a, b) => b.centrality - a.centrality);

  // Pick top N
  const topPicked = scoredSentences.slice(0, targetCount);

  // Restore chronological order
  topPicked.sort((a, b) => a.idx - b.idx);

  return topPicked.map((item) => item.sentence);
}

/**
 * 6. Converts keyword phrase to standard Title Case heading.
 * @param {string} phrase
 * @returns {string}
 */
export function toTitleCase(phrase) {
  if (!phrase) return 'Lecture Topic';
  return phrase
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Main NLP pipeline entry point.
 * Given a raw transcript string, structures it into numbered topic sections.
 *
 * @param {string} transcript
 * @returns {Array<{ id: string, heading: string, keywords: string[], bullets: string[], sentences: string[] }>}
 */
export function structureNote(transcript) {
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return [];
  }

  const sentences = splitSentences(transcript);
  if (sentences.length === 0) {
    return [];
  }

  const { idf, vectors } = buildTfIdf(sentences);
  const segmentIndices = segmentSentences(sentences, vectors);

  const sections = segmentIndices.map((indices, segIdx) => {
    const segSentences = indices.map((i) => sentences[i]);
    const segVectors = indices.map((i) => vectors[i]);

    const keywords = extractKeywords(segSentences, idf);
    const bullets = extractBullets(segSentences, segVectors);

    // Primary heading: prefer the top multi-word key phrase if present for academic clarity
    const bestHeadingCandidate =
      keywords.find((k) => k.includes(' ')) || keywords[0] || `Section ${segIdx + 1}`;
    const heading = toTitleCase(bestHeadingCandidate);

    return {
      id: `topic-${segIdx + 1}`,
      heading: `${heading}`,
      keywords: keywords.length > 0 ? keywords : ['lecture', 'overview'],
      bullets: bullets.length > 0 ? bullets : segSentences.slice(0, 3),
      sentences: segSentences,
    };
  });

  return sections;
}

/**
 * Builds an alphabetical glossary of keywords with occurrences across the note.
 * @param {Array<{ keywords: string[], sentences: string[] }>} sections
 * @returns {Array<{ term: string, count: number, example: string }>}
 */
export function buildGlossary(sections) {
  const glossaryMap = new Map();

  sections.forEach((sec) => {
    sec.keywords.forEach((kw) => {
      const termLower = kw.toLowerCase();
      // Find an example sentence containing this keyword
      const example =
        sec.sentences.find((s) => s.toLowerCase().includes(termLower)) ||
        sec.bullets[0] ||
        '';

      if (!glossaryMap.has(termLower)) {
        glossaryMap.set(termLower, {
          term: toTitleCase(kw),
          count: 1,
          example,
        });
      } else {
        const item = glossaryMap.get(termLower);
        item.count += 1;
      }
    });
  });

  return Array.from(glossaryMap.values()).sort((a, b) =>
    a.term.localeCompare(b.term)
  );
}
