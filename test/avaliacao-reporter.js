const { setResumoJest, escreverRelatorio, REPORT_PATH } = require('./report-writer');

class AvaliacaoReporter {
  onRunComplete(_contexts, results) {
    setResumoJest({
      passed: results.numPassedTests,
      failed: results.numFailedTests,
      total: results.numTotalTests,
      status: results.numFailedTests > 0 ? 'FALHOU' : 'APROVADO',
    });
    escreverRelatorio();
    // eslint-disable-next-line no-console
    console.log(`\n📄 Relatório salvo em: ${REPORT_PATH}\n`);
  }
}

module.exports = AvaliacaoReporter;
