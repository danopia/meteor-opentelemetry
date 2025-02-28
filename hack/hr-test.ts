type HrTime = [number, number];

function sumMillisWithHrTime(millis: number, time: HrTime): HrTime {
  if (millis == 0) return time;
  if (millis > 0) {
    const fullNanos = time[1] + (millis * 1_000_000);
    const justNanos = fullNanos % 1_000_000_000;
    const extraSeconds = (fullNanos - justNanos) / 1_000_000_000;
    return [time[0] + extraSeconds, justNanos];
  } else {
    const fullNanos = time[1] + (millis * 1_000_000);
    const secondsBehind = Math.ceil(-fullNanos / 1_000_000_000);
    const remainingNanos = fullNanos + (secondsBehind * 1_000_000_000);
    return [time[0] - secondsBehind, remainingNanos];
  }
}

function test(millis: number, time: HrTime, expected: HrTime) {
  const result = sumMillisWithHrTime(millis, time);
  console.log({ millis, time, result });
  if (result[0] !== expected[0] && result[1] !== expected[1]) console.log('^^ wrong');
}

test(0,     [42,   0        ], [ 42,   0         ]);
test(1,     [42,   0        ], [ 42,   1_000_000 ]);
test(4500,  [42,   0        ], [ 46, 500_000_000 ]);
test(1,     [42, 998_111_111], [ 42, 999_111_111 ]);
test(1,     [42, 999_111_111], [ 43,     111_111 ]);
test(-1,    [42,   0        ], [ 41, 999_000_000 ]);
test(-4500, [42,   0        ], [ 37, 500_000_000 ]);
