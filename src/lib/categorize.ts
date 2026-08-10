/**
 * Category suggestions for an expense title.
 *
 * Two independent guessers, both pure and both deliberately silent when the
 * answer is unclear — a wrong category is worse than none, because nobody
 * proofreads the dropdown and the mistake only surfaces later on the totals
 * page. Callers try history first (the group's own vocabulary beats any word
 * list) and fall back to the rules.
 */

export const CATEGORIES = [
    'General',
    'Food',
    'Transport',
    'Stay',
    'Groceries',
    'Activities',
    'Others',
] as const

export type Category = (typeof CATEGORIES)[number]

/** 'General' means "no opinion", so it is never suggested. */
type SuggestableCategory = Exclude<Category, 'General'>

export function isCategory(value: string): value is Category {
    return (CATEGORIES as readonly string[]).includes(value)
}

/**
 * Phrases are matched as whole words, and the longest matching phrase wins —
 * so "grab dinner" (Food, 2 words) beats "grab" (Transport, 1 word) without
 * either rule needing to know about the other.
 *
 * Convenience stores are missing on purpose: a 7-Eleven run is Groceries for
 * some groups and Food for others, so that call is left to group history.
 */
const RULES: { category: SuggestableCategory; phrases: string[] }[] = [
    {
        category: 'Transport',
        phrases: [
            'grab', 'gojek', 'taxi', 'cab', 'uber', 'lyft', 'bolt', 'tuk tuk',
            'mrt', 'lrt', 'bts', 'subway', 'metro', 'train', 'bus', 'tram', 'shuttle',
            'shinkansen', 'jr pass', 'suica', 'pasmo', 'ez link', 'ezlink', 'octopus card',
            'flight', 'flights', 'airfare', 'airline', 'airport transfer', 'baggage',
            'ferry', 'car rental', 'rental car', 'petrol', 'fuel', 'toll', 'tolls',
            'parking', 'car park', 'transport', 'transfer to airport',
        ],
    },
    {
        category: 'Food',
        phrases: [
            'grabfood', 'grab food', 'grab dinner', 'grab lunch', 'grab breakfast',
            'foodpanda', 'deliveroo', 'doordash',
            'restaurant', 'dinner', 'lunch', 'breakfast', 'brunch', 'supper', 'buffet',
            'cafe', 'coffee', 'starbucks', 'tea', 'boba', 'bubble tea', 'bakery',
            'bar', 'drinks', 'beer', 'cocktails', 'izakaya', 'pub',
            'ramen', 'sushi', 'omakase', 'yakiniku', 'teppanyaki', 'udon', 'soba',
            'tempura', 'donburi', 'gyoza', 'curry', 'hotpot', 'mala', 'bbq',
            'dim sum', 'hawker', 'food court', 'kopitiam', 'zi char',
            'chicken rice', 'laksa', 'satay', 'nasi', 'roti', 'pho', 'banh mi',
            'pizza', 'burger', 'burgers', 'tacos', 'mcdonald', 'mcdonalds', 'kfc',
            'dessert', 'ice cream', 'snacks', 'street food',
        ],
    },
    {
        category: 'Stay',
        phrases: [
            'hotel', 'hostel', 'motel', 'inn', 'ryokan', 'guesthouse', 'guest house',
            'airbnb', 'agoda', 'booking com', 'accommodation', 'lodging',
            'homestay', 'resort', 'capsule', 'apartment', 'villa',
        ],
    },
    {
        category: 'Groceries',
        phrases: [
            'grocery', 'groceries', 'supermarket', 'ntuc', 'fairprice', 'cold storage',
            'sheng siong', 'donki', 'don don donki', 'aeon', 'costco', 'walmart',
            'tesco', 'big c', 'wet market', 'produce',
        ],
    },
    {
        category: 'Activities',
        phrases: [
            'museum', 'gallery', 'ticket', 'tickets', 'entrance', 'entry fee', 'admission',
            'tour', 'guided tour', 'theme park', 'national park', 'disney', 'disneyland',
            'universal studios', 'uss', 'zoo', 'aquarium', 'observatory',
            'onsen', 'spa', 'massage', 'karaoke', 'cinema', 'movie', 'concert', 'show',
            'ski', 'lift pass', 'snorkel', 'snorkeling', 'diving', 'hiking', 'cable car',
            'temple', 'shrine', 'escape room', 'bowling', 'golf', 'kayak', 'go kart',
        ],
    },
    {
        category: 'Others',
        phrases: [
            'sim card', 'esim', 'laundry', 'pharmacy', 'medicine', 'luggage',
            'souvenir', 'souvenirs', 'gift', 'gifts', 'insurance', 'visa fee',
        ],
    },
]

/** Words too common to carry a category signal on their own. */
const STOPWORDS = new Set([
    'a', 'an', 'and', 'at', 'for', 'from', 'in', 'of', 'on', 'our', 'the', 'to',
    'with', 'my', 'we', 'us', 'day', 'trip',
])

/** Lowercase, strip punctuation, collapse whitespace: "7-Eleven!" → "7 eleven". */
export function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function tokenize(title: string): string[] {
    const normalized = normalizeTitle(title)
    return normalized ? normalized.split(' ') : []
}

/** True when `phrase` appears in `words` as a run of whole words. */
function containsPhrase(words: string[], phrase: string[]): boolean {
    if (phrase.length === 0 || phrase.length > words.length) return false
    for (let i = 0; i <= words.length - phrase.length; i++) {
        if (phrase.every((word, j) => words[i + j] === word)) return true
    }
    return false
}

/**
 * Keyword guess from the built-in rules. Returns null when nothing matches or
 * when equally specific rules disagree ("hotel bar" is Stay to one rule and
 * Food to another, so it stays uncategorised).
 */
export function suggestFromRules(title: string): Category | null {
    const words = tokenize(title)
    if (words.length === 0) return null

    let bestLength = 0
    const winners = new Set<Category>()

    for (const rule of RULES) {
        for (const phrase of rule.phrases) {
            const phraseWords = phrase.split(' ')
            if (phraseWords.length < bestLength) continue
            if (!containsPhrase(words, phraseWords)) continue
            if (phraseWords.length > bestLength) {
                bestLength = phraseWords.length
                winners.clear()
            }
            winners.add(rule.category)
        }
    }

    return winners.size === 1 ? [...winners][0]! : null
}

/** One (title, category) pair the group has used before, with how often. */
export interface CategoryHint {
    title: string
    category: string
    count: number
}

/**
 * Guess from what this group has categorised before. An earlier title counts
 * as evidence when all of its meaningful words appear in what's being typed
 * now — so a past "Grab" informs "Grab to the airport", but a past
 * "Grab to Shibuya" doesn't get dragged into "Grab dinner".
 *
 * An exact repeat of a past title is trusted immediately; looser word matches
 * need at least two past uses and a clear two-thirds majority.
 */
export function suggestFromHistory(title: string, hints: CategoryHint[]): Category | null {
    const words = tokenize(title)
    if (words.length === 0 || hints.length === 0) return null

    const typed = new Set(words)
    const normalized = words.join(' ')

    const exact = new Map<Category, number>()
    const loose = new Map<Category, number>()
    let looseCount = 0

    for (const hint of hints) {
        if (!isCategory(hint.category) || hint.category === 'General') continue
        const hintWords = tokenize(hint.title)
        if (hintWords.length === 0) continue

        if (hintWords.join(' ') === normalized) {
            exact.set(hint.category, (exact.get(hint.category) ?? 0) + hint.count)
            continue
        }

        const meaningful = hintWords.filter((w) => !STOPWORDS.has(w))
        if (meaningful.length === 0) continue
        if (!meaningful.every((w) => typed.has(w))) continue

        // Longer overlaps are stronger evidence than a single shared word.
        loose.set(hint.category, (loose.get(hint.category) ?? 0) + hint.count * meaningful.length)
        looseCount += hint.count
    }

    const exactWinner = dominant(exact, 0.5)
    if (exactWinner) return exactWinner

    return looseCount >= 2 ? dominant(loose, 2 / 3) : null
}

/** The single category holding more than `share` of the weight, if any. */
function dominant(weights: Map<Category, number>, share: number): Category | null {
    let total = 0
    let best: Category | null = null
    let bestWeight = 0
    let tied = false

    for (const [category, weight] of weights) {
        total += weight
        if (weight > bestWeight) {
            best = category
            bestWeight = weight
            tied = false
        } else if (weight === bestWeight) {
            tied = true
        }
    }

    if (!best || tied || total === 0) return null
    return bestWeight / total > share ? best : null
}
