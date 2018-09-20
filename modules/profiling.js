const _ = require('lodash');
const EventLoopLatency = require('eventloop-latency');

const { assertApp, assertSystem } = require('./error-handling');
const log = require('./log');

const IS_PROFILING_ON = process.env.FREEFALL_PROFILING_ON;
const EMIT_INTERVAL = +process.env.PROFILING_EL_EMIT_INTERVAL;
const LATENCY_CHECK_INTERVAL = +process.env.PROFILING_EL_LATENCY_CHECK_INTERVAL;
const NS_PER_SEC = 1e9;
const MS_PER_NS = 1e6;

if (IS_PROFILING_ON) {
  assertSystem(
    Number.isInteger(EMIT_INTERVAL),
    'Please set the PROFILING_EL_EMIT_INTERVAL variable to an integer',
  );
  assertSystem(
    Number.isInteger(LATENCY_CHECK_INTERVAL),
    'Please set the PROFILING_EL_LATENCY_CHECK_INTERVAL variable.',
  );
}

function profilingIsEnabled () {
  return IS_PROFILING_ON != null && IS_PROFILING_ON.toLowerCase() === 'true';
}

function profileEventLoop (
  emitInterval = EMIT_INTERVAL,
  latencyCheckInterval = LATENCY_CHECK_INTERVAL
) {
  assertApp(Number.isInteger(emitInterval));
  assertApp(Number.isInteger(latencyCheckInterval));

  if (!profilingIsEnabled()) {
    return;
  }

  const eventLoopLatencyMonitor = new EventLoopLatency(
    emitInterval,
    latencyCheckInterval
  );
  eventLoopLatencyMonitor.on('data', data => {
    const max = Math.max(...data);
    const average = data.reduce((sum, num) => sum + num, 0) / data.length;
    log.info(
      'START eventloop-latency REPORT',
      `Max: ${max} microseconds\tAverage: ${average} microseconds\tInterval: ${emitInterval} ms`,
      'END eventloop-latency REPORT',
    );
  });
  eventLoopLatencyMonitor.start(true);

  // const latencyMonitor = new LatencyMonitor();
  // log.info('Event Loop Latency Monitor Loaded: %O', {
  //   latencyCheckIntervalMs: latencyCheckInterval,
  //   dataEmitIntervalMs: emitInterval,
  // });
  // latencyMonitor.on(
  //   'data',
  //   summary => log.info(
  //     'START latency-monitor REPORT',
  //     `Max: ${summary.maxMs} ms\tAverage: ${summary.avgMs} ms\tInterval: ${emitInterval} ms`,
  //     'END latency-monitor REPORT',
  //   )
  // );
}

function profileAsync (asyncFunc, options = {}) {
  assertApp(_.isFunction(asyncFunc));
  assertApp(_.isObject(options));

  if (!profilingIsEnabled()) {
    log.info('Profiling is not enabled returning from profileAsync');
    return asyncFunc;
  }

  const { emitInterval = EMIT_INTERVAL, name = asyncFunc.name } = options;
  const latencies = [];

  async function wrapped (...args) {
    const start = process.hrtime();
    const result = await asyncFunc(...args);

    const [seconds, nanoseconds] = process.hrtime(start);
    latencies.push(seconds * NS_PER_SEC + nanoseconds);

    return result;
  }

  log.info(`Created a setInterval event in order to profile function '${name}'`);

  setInterval(() => {
    let max = 'Unknown';
    let total = 'Unknown';
    // eslint-disable-next-line no-undef
    let average = 'Unknown';

    if (latencies.length) {
      max = 0;
      total = 0;
      for (const lat of latencies) {
        max = max < lat ? lat : max;
        total += lat;
      }
      average = total / latencies.length;
    }

    log.info(
      'START profileAsync REPORT',
      `Profiled function is '${name}'`,
      `Max: ${max / MS_PER_NS} ms\tAverage: ${average / MS_PER_NS} ms\tInterval: ${emitInterval} ms`,
      'END profileAsync REPORT'
    );
  }, emitInterval);

  return wrapped;
}

module.exports = { profileAsync, profileEventLoop };
