const state = {
  workbookXml: '',
  filename: 'FAQ_Output_WMF_Local_Demo.xlsx',
  previewRows: [],
  previewIndex: 0,
  hasRunPreview: false,
};

function selectedUrls() {
  const single = document.querySelector('#single-url').value.trim();
  const pasted = document
    .querySelector('#url-list')
    .value.split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Array.from(new Set([single, ...pasted].filter(Boolean)));
}

function inferredLocaleFromUrl(url) {
  try {
    const match = decodeURIComponent(new URL(url).pathname).toLowerCase().match(/\/de\/(de|en|fr|es|nl)(?:\/|$)/);
    return match ? match[1] : 'de';
  } catch {
    return 'de';
  }
}

function selectedLanguages() {
  const checked = Array.from(document.querySelectorAll('input[name="language"]:checked')).map((input) => input.value);
  const urls = selectedUrls();
  const sourceLanguage = inferredLocaleFromUrl(urls[0] || '');
  if (checked.length === 1 && checked[0] === 'de' && sourceLanguage !== 'de') {
    return [sourceLanguage];
  }
  return Array.from(new Set(checked));
}

function selectedRunMode() {
  return document.querySelector('#run-mode').value;
}

function selectedMaxFaqCount() {
  return Number(document.querySelector('#max-faq-count').value);
}

function previewInput() {
  return {
    urls: selectedUrls(),
    target_languages: selectedLanguages(),
    run_mode: selectedRunMode(),
    max_faq_count: selectedMaxFaqCount(),
    cost_ceiling_eur: Number(document.querySelector('#cost-ceiling').value || 50),
  };
}

function renderDefinitionList(element, rows) {
  element.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderFaqPreview() {
  const panel = document.querySelector('#faq-preview-panel');
  const empty = document.querySelector('#faq-preview-empty');
  const content = document.querySelector('#faq-preview-content');
  const row = state.previewRows[state.previewIndex];

  panel.hidden = !state.hasRunPreview;
  empty.hidden = Boolean(row);
  content.hidden = !row;
  if (!row) return;

  document.querySelector('#faq-preview-position').textContent = `Product ${state.previewIndex + 1} of ${state.previewRows.length}`;
  renderDefinitionList(document.querySelector('#faq-preview-meta'), [
    ['URL', escapeHtml(row.url)],
    ['product_id', escapeHtml(row.product_id)],
    ['Status', escapeHtml(row.status)],
    ['Selected languages', row.selected_languages.map((language) => window.LocalPreview.languageLabels[language] || language).join(', ')],
    ['FAQ count', row.faq_count],
  ]);
  document.querySelector('#faq-preview-list').innerHTML = row.faqs
    .map(
      (faq) => `<article class="faq-card">
        <div class="faq-card-meta">
          <span>${escapeHtml(faq.language)}</span>
          <span>${escapeHtml(faq.status)}</span>
        </div>
        <h4>${escapeHtml(faq.question)}</h4>
        <p>${escapeHtml(faq.answer)}</p>
      </article>`,
    )
    .join('');
  document.querySelector('#preview-previous').disabled = state.previewIndex === 0;
  document.querySelector('#preview-next').disabled = state.previewIndex >= state.previewRows.length - 1;
}

function renderCost() {
  const estimate = window.LocalPreview.estimateLocalPreview(previewInput());
  renderDefinitionList(document.querySelector('#cost-panel'), [
    ['Selected URL count', estimate.url_count],
    ['Selected languages', estimate.languages.map((language) => window.LocalPreview.languageLabels[language]).join(', ')],
    ['Run mode', estimate.run_mode],
    ['Estimated provider cost', `EUR ${estimate.provider_cost_estimate.toFixed(4)}`],
    ['Margin rate', `${Math.round(estimate.margin_rate * 100)}%`],
    ['Estimated internal/client cost', `EUR ${estimate.client_cost_estimate.toFixed(4)}`],
    ['Confirmation required', estimate.requires_confirmation ? 'Yes' : 'No'],
  ]);
  return estimate;
}

function runPreview() {
  const input = previewInput();
  renderCost();
  const result = window.LocalPreview.runLocalPreview(input);

  document.querySelector('#mode-note').textContent = `${result.modeLabel}. Results are generated without live services.`;
  renderDefinitionList(document.querySelector('#result-panel'), [
    ['Job status', result.jobStatus],
    ['URLs processed', result.urlsProcessed],
    ['Internal sub-batches', result.internalSubBatches],
    ['Generated FAQ items', result.generatedFaqItems],
    ['Selected languages', input.target_languages.map((language) => window.LocalPreview.languageLabels[language]).join(', ')],
    ['Generated languages', result.selectedLanguages.map((language) => window.LocalPreview.languageLabels[language]).join(', ')],
    ['Warnings', (result.warnings || []).join(' | ') || 'None'],
    ['Approved', result.quality.approved],
    ['Draft', result.quality.draft],
    ['Needs review', result.quality.needsReview],
    ['Claim risk failures', result.quality.claimRiskFailures],
    ['High severity risks', result.quality.highSeverityRisks],
    ['Preview workbook available', result.previewWorkbookAvailable ? 'Yes' : 'No'],
    ['Final workbook available', result.finalWorkbookAvailable ? 'Yes' : 'No'],
  ]);

  const previewRows = result.preview_rows || [];
  document.querySelector('#pause-warning').hidden = !result.quality.shouldPause || result.jobStatus === 'Completed';
  document.querySelector('#cost-blocked-message').hidden = result.jobStatus !== 'Cost Estimated' || !result.confirmationRequired;
  document.querySelector('#tab-table').innerHTML = result.workbookTabs.map((tab) => `<tr><td>${tab.name}</td><td>${tab.rowCount}</td></tr>`).join('');
  state.previewRows = previewRows;
  state.previewIndex = 0;
  state.hasRunPreview = true;
  renderFaqPreview();
  if (state.previewRows.length > 0) {
    document.querySelector('#faq-preview-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  state.filename = result.filename || state.filename;
  state.workbookXml = result.excelXml || '';
  document.querySelector('#download-button').disabled = !state.workbookXml;
}

function downloadWorkbook() {
  if (!state.workbookXml) return;
  const blob = new Blob([state.workbookXml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = state.filename;
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelector('#run-mode').addEventListener('change', () => {
  document.querySelector('#max-faq-count').disabled = selectedRunMode() !== 'premium-p1';
  if (selectedRunMode() !== 'premium-p1') {
    document.querySelector('#max-faq-count').value = '12';
  }
});
document.querySelector('#estimate-button').addEventListener('click', renderCost);
document.querySelector('#run-button').addEventListener('click', runPreview);
document.querySelector('#download-button').addEventListener('click', downloadWorkbook);
document.querySelector('#preview-previous').addEventListener('click', () => {
  state.previewIndex = window.LocalPreview.carouselIndex(state.previewIndex, state.previewRows.length, 'previous');
  renderFaqPreview();
});
document.querySelector('#preview-next').addEventListener('click', () => {
  state.previewIndex = window.LocalPreview.carouselIndex(state.previewIndex, state.previewRows.length, 'next');
  renderFaqPreview();
});
document.querySelector('#max-faq-count').disabled = true;
renderCost();
