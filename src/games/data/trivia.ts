// Road Trivia question bank — customer-service + road-trip themed, for The
// Extra Mile. Draft set for review; edit freely. Each round draws a random 10.
export type TriviaQuestion = {
  q: string
  choices: string[]
  answer: number // index into choices
}

export const TRIVIA: TriviaQuestion[] = [
  {
    q: 'A customer can’t find an item. Going the “extra mile” means:',
    choices: [
      'Point to the aisle',
      'Walk them to it and check stock',
      'Say you’re not sure',
      'Ask them to look again',
    ],
    answer: 1,
  },
  {
    q: 'What’s the best first thing to say to an upset customer?',
    choices: [
      '“Calm down.”',
      '“That’s our policy.”',
      '“I’m sorry that happened — let’s fix it.”',
      'Nothing, wait for them to finish',
    ],
    answer: 2,
  },
  {
    q: 'The 7-Eleven Slurpee was originally called:',
    choices: ['The Freeze', 'The Icee', 'The Chill', 'The Frostie'],
    answer: 1,
  },
  {
    q: 'Which sign tells you the speed you must not exceed?',
    choices: ['Yellow diamond', 'White rectangle speed limit', 'Green mile marker', 'Blue services sign'],
    answer: 1,
  },
  {
    q: '“Active listening” with a customer mostly means:',
    choices: [
      'Planning your reply while they talk',
      'Repeating back what they need to confirm',
      'Finishing their sentences',
      'Multitasking to save time',
    ],
    answer: 1,
  },
  {
    q: 'On a road trip, a “rest stop” is for:',
    choices: ['Refueling only', 'Resting, restrooms, and stretching', 'Buying a car', 'Changing tires only'],
    answer: 1,
  },
  {
    q: 'A guest is a few cents short. The best service move is usually to:',
    choices: [
      'Refuse the sale',
      'Cover it if allowed and keep it friendly',
      'Lecture them',
      'Call a manager to the front loudly',
    ],
    answer: 1,
  },
  {
    q: '7-Eleven is named after its original:',
    choices: ['7 aisles, 11 registers', '7 a.m.–11 p.m. hours', '$7.11 first sale', '7-Eleven highway'],
    answer: 1,
  },
  {
    q: 'What does a flashing yellow traffic light mean?',
    choices: ['Stop fully', 'Proceed with caution', 'Speed up', 'Road closed'],
    answer: 1,
  },
  {
    q: 'The “extra mile” idea comes from the idea of:',
    choices: [
      'Doing exactly what’s required',
      'Doing more than expected',
      'Driving farther to work',
      'A marathon distance',
    ],
    answer: 1,
  },
  {
    q: 'A customer thanks you. The strongest response is:',
    choices: ['“No problem.”', '“It’s my pleasure — come back soon!”', 'Silence + nod', '“Just doing my job.”'],
    answer: 1,
  },
  {
    q: 'National Coffee Day is celebrated in:',
    choices: ['January', 'September/October', 'March', 'June'],
    answer: 1,
  },
  {
    q: 'When you don’t know an answer, the best service habit is to:',
    choices: ['Guess confidently', 'Say “I don’t know” and stop', 'Find out and follow up', 'Send them away'],
    answer: 2,
  },
  {
    q: 'A “detour” sign means:',
    choices: ['Road ahead is faster', 'Follow an alternate route', 'Dead end', 'No entry ever'],
    answer: 1,
  },
  {
    q: 'Big Gulp is a 7-Eleven icon for what kind of drink?',
    choices: ['Coffee', 'A large fountain soft drink', 'Energy shot', 'Bottled water'],
    answer: 1,
  },
  {
    q: 'Best way to greet a customer walking in:',
    choices: ['Ignore until they approach', 'Warm greeting and eye contact', 'Ask “What do you want?”', 'Keep facing away'],
    answer: 1,
  },
  {
    q: 'What does HOV lane stand for?',
    choices: ['Heavy Oversized Vehicle', 'High-Occupancy Vehicle', 'Highway Overtake Vehicle', 'Hourly Open Vehicle'],
    answer: 1,
  },
  {
    q: 'A long line is forming. Great service is to:',
    choices: [
      'Slow down to be careful',
      'Acknowledge waiting guests and move efficiently',
      'Take a break',
      'Blame the rush',
    ],
    answer: 1,
  },
  {
    q: 'The yellow dashed line down a road means:',
    choices: ['No passing', 'Passing allowed with care', 'Shoulder only', 'Bike lane'],
    answer: 1,
  },
  {
    q: 'Free Slurpee Day at 7-Eleven is traditionally on:',
    choices: ['July 11 (7/11)', 'January 1', 'December 25', 'April 15'],
    answer: 0,
  },
  {
    q: 'Empathy in service means:',
    choices: [
      'Agreeing with everything',
      'Understanding how the customer feels',
      'Giving discounts always',
      'Speaking faster',
    ],
    answer: 1,
  },
  {
    q: 'A “mile marker” on a highway helps you:',
    choices: ['Know the speed limit', 'Track distance and location', 'Find gas prices', 'Read the weather'],
    answer: 1,
  },
  {
    q: 'Best recovery after a service mistake:',
    choices: ['Hope they don’t notice', 'Own it, apologize, make it right', 'Blame a coworker', 'Change the subject'],
    answer: 1,
  },
  {
    q: 'What color are most interstate highway shields in the U.S.?',
    choices: ['Red and yellow', 'Red, white, and blue', 'Green and white', 'Black and orange'],
    answer: 1,
  },
  {
    q: 'Going the extra mile for a regular customer might mean:',
    choices: [
      'Remembering their usual order',
      'Charging them more',
      'Rushing them out',
      'Ignoring their name',
    ],
    answer: 0,
  },
]
