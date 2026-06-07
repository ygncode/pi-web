<script>
  // The ask_user_question tool card. Renders the structure declaratively; the
  // option/submit buttons carry data-question/data-answer + classes that the chat
  // composer's delegated click handler turns into a chat reply. Mirrors the former
  // renderAskUserQuestionTool().
  import { icon, Check } from '../../shared/icons.js';

  let { args = {}, result = null } = $props();

  const questions = $derived(Array.isArray(args.questions) ? args.questions : []);
  const answers = $derived(result?.details?.answers || {});
  const cancelled = $derived(result?.details?.cancelled === true);
  const awaitingChatReply = $derived(result?.details?.awaitingChatReply === true);
  const questionToolFailed = $derived(result?.isError === true);
  const canClick = $derived(!result || questionToolFailed || awaitingChatReply);
  const isInteractive = $derived(canClick || cancelled);
  const isMulti = $derived(questions.length > 1);
  const anyMultiSelect = $derived(questions.some((q) => q && q.multiSelect === true));
  const needsSubmit = $derived(isMulti || anyMultiSelect);

  function optionLabel(option) {
    return typeof option?.label === 'string' ? option.label : String(option || '');
  }
  function optionDesc(option) {
    return typeof option?.description === 'string' ? option.description : '';
  }
  function isSelected(answer, label) {
    return answer === label || (typeof answer === 'string' && answer.split(', ').includes(label));
  }
  function questionTextOf(q, i) {
    return typeof q.question === 'string' ? q.question : `Question ${i + 1}`;
  }
</script>

<div class="ask-question-card" data-question-count={questions.length} data-needs-submit={needsSubmit}>
  <div class="ask-question-title">Question for you</div>
  {#if questionToolFailed}
    <div class="ask-question-state error">question UI failed</div>
  {:else if cancelled}
    <div class="ask-question-state error">cancelled</div>
  {:else if awaitingChatReply}
    <div class="ask-question-state pending">waiting for response</div>
  {:else if result}
    <div class="ask-question-state answered">answered</div>
  {:else}
    <div class="ask-question-state pending">waiting for response</div>
  {/if}

  {#if questions.length === 0}
    <div class="ask-question-text">No question payload provided.</div>
  {/if}

  {#each questions as q, qIndex}
    {@const questionText = questionTextOf(q, qIndex)}
    {@const answer = answers[questionText]}
    {@const options = Array.isArray(q.options) ? q.options : []}
    <div class="ask-question-block" data-question-text={questionText} data-multi-select={q && q.multiSelect === true}>
      {#if q.header}<div class="ask-question-header">{String(q.header)}</div>{/if}
      <div class="ask-question-text">{questionText}</div>
      {#if options.length > 0}
        <div class="ask-question-options">
          {#each options as option}
            {@const label = optionLabel(option)}
            {@const desc = optionDesc(option)}
            {@const selected = isSelected(answer, label)}
            {#if isInteractive}
              <button type="button" class="ask-question-option{selected ? ' selected' : ''} ask-question-option-action" data-question={questionText} data-answer={label}>
                <div class="ask-question-option-label">{#if selected}{@html icon(Check, { size: 13 })} {/if}{label}</div>
                {#if desc}<div class="ask-question-option-desc">{desc}</div>{/if}
              </button>
            {:else}
              <div class="ask-question-option{selected ? ' selected' : ''}">
                <div class="ask-question-option-label">{#if selected}{@html icon(Check, { size: 13 })} {/if}{label}</div>
                {#if desc}<div class="ask-question-option-desc">{desc}</div>{/if}
              </div>
            {/if}
          {/each}
        </div>
      {/if}
      {#if answer}<div class="ask-question-answer"><span>Answer:</span> {String(answer)}</div>{/if}
    </div>
  {/each}

  {#if isInteractive}
    {#if needsSubmit}
      <div class="ask-question-actions" style="display:none"><button type="button" class="ask-question-submit-btn">Send answers</button></div>
    {:else if questionToolFailed}
      <div class="ask-question-hint">Use these options as a fallback — click an option to send your answer to pi.</div>
    {:else if cancelled}
      <div class="ask-question-hint">Click an option to send your answer to pi.</div>
    {:else if !result || awaitingChatReply}
      <div class="ask-question-hint">Click an option, or use the chat composer below, to answer this question.</div>
    {/if}
  {/if}
</div>
