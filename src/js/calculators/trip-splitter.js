// Trip Cost Splitter — vanilla JS widget
// Uses document.createElement + textContent for all user-provided values.
// No innerHTML is ever set with user input.

(function () {
  const labels = window.__calcLabels || {};
  const locale = window.__calcLocale || 'en';
  const currency = window.__calcCurrency || 'EUR';
  const container = document.getElementById('trip-splitter');
  if (!container) return;

  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });

  // ----- state -----
  let people = [
    { id: uid(), name: labels.example_name_1 || 'Alex' },
    { id: uid(), name: labels.example_name_2 || 'Sam' },
  ];
  let expenses = [
    { id: uid(), desc: labels.example_expense || 'Dinner', amount: 60, paidBy: null, participants: [] },
  ];
  // Link first expense to real IDs
  expenses[0].paidBy = people[0].id;
  expenses[0].participants = people.map((p) => p.id);

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  // Small DOM builder helpers — never accept untrusted HTML, only text
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k.startsWith('data-')) e.setAttribute(k, attrs[k]);
        else if (k === 'value') e.value = attrs[k];
        else if (k === 'checked' && attrs[k]) e.checked = true;
        else if (k === 'selected' && attrs[k]) e.selected = true;
        else if (k === 'type') e.type = attrs[k];
        else if (k === 'placeholder') e.placeholder = attrs[k];
        else if (k === 'step') e.step = attrs[k];
        else if (k === 'min') e.min = attrs[k];
        else if (k === 'aria-label') e.setAttribute('aria-label', attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }

  function icon(name) {
    return el('span', { class: 'material-symbols-outlined text-base', text: name });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // ----- render -----
  function render() {
    clear(container);

    const wrap = el('div', { class: 'space-y-6' });

    // People section
    const peopleSection = el('div');
    const peopleTitle = el('h2', { class: 'text-xl font-extrabold text-darkBlue mb-4 flex items-center gap-2' }, [
      el('span', { class: 'material-symbols-outlined text-terracotta', text: 'group' }),
      labels.people_title || 'People',
    ]);
    peopleSection.appendChild(peopleTitle);
    const peopleList = el('div', { class: 'space-y-2 mb-3', id: 'ts-people' });
    peopleSection.appendChild(peopleList);
    const addPersonBtn = el('button', {
      type: 'button',
      class: 'text-sm font-semibold text-terracotta hover:underline inline-flex items-center gap-1',
    }, [
      el('span', { class: 'material-symbols-outlined text-base', text: 'add_circle' }),
      labels.add_person || 'Add person',
    ]);
    addPersonBtn.addEventListener('click', addPerson);
    peopleSection.appendChild(addPersonBtn);
    wrap.appendChild(peopleSection);

    // Expenses section
    const expSection = el('div');
    const expTitle = el('h2', { class: 'text-xl font-extrabold text-darkBlue mb-4 flex items-center gap-2' }, [
      el('span', { class: 'material-symbols-outlined text-terracotta', text: 'receipt_long' }),
      labels.expenses_title || 'Expenses',
    ]);
    expSection.appendChild(expTitle);
    const expList = el('div', { class: 'space-y-4 mb-3', id: 'ts-expenses' });
    expSection.appendChild(expList);
    const addExpBtn = el('button', {
      type: 'button',
      class: 'text-sm font-semibold text-terracotta hover:underline inline-flex items-center gap-1',
    }, [
      el('span', { class: 'material-symbols-outlined text-base', text: 'add_circle' }),
      labels.add_expense || 'Add expense',
    ]);
    addExpBtn.addEventListener('click', addExpense);
    expSection.appendChild(addExpBtn);
    wrap.appendChild(expSection);

    // Results section
    const resSection = el('div', { class: 'border-t border-gray-200 pt-6' });
    const resTitle = el('h2', { class: 'text-xl font-extrabold text-darkBlue mb-4 flex items-center gap-2' }, [
      el('span', { class: 'material-symbols-outlined text-sage', text: 'account_balance' }),
      labels.results_title || 'Who owes who',
    ]);
    resSection.appendChild(resTitle);
    const results = el('div', { id: 'ts-results' });
    resSection.appendChild(results);
    wrap.appendChild(resSection);

    container.appendChild(wrap);

    renderPeople();
    renderExpenses();
    renderResults();
  }

  function renderPeople() {
    const node = document.getElementById('ts-people');
    clear(node);
    people.forEach((p) => {
      const row = el('div', { class: 'flex items-center gap-2' });
      const input = el('input', {
        type: 'text',
        value: p.name,
        'data-id': p.id,
        class: 'flex-1 rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-darkBlue focus:ring-2 focus:ring-terracotta focus:outline-none',
      });
      input.addEventListener('input', (e) => {
        const person = people.find((x) => x.id === p.id);
        if (person) {
          person.name = e.target.value;
          renderExpenses();
          renderResults();
        }
      });
      row.appendChild(input);

      if (people.length > 2) {
        const rm = el('button', {
          type: 'button',
          class: 'text-gray-400 hover:text-terracotta',
          'aria-label': labels.remove || 'Remove',
        }, [el('span', { class: 'material-symbols-outlined text-base', text: 'close' })]);
        rm.addEventListener('click', () => {
          people = people.filter((x) => x.id !== p.id);
          expenses = expenses
            .map((ex) => ({
              ...ex,
              paidBy: ex.paidBy === p.id ? (people[0] ? people[0].id : null) : ex.paidBy,
              participants: ex.participants.filter((id) => id !== p.id),
            }))
            .filter((ex) => ex.paidBy && ex.participants.length);
          render();
        });
        row.appendChild(rm);
      }
      node.appendChild(row);
    });
  }

  function renderExpenses() {
    const node = document.getElementById('ts-expenses');
    clear(node);
    expenses.forEach((ex) => {
      const row = el('div', { class: 'bg-white border border-gray-200 rounded-xl p-4 space-y-3' });

      // Desc + amount + remove row
      const head = el('div', { class: 'flex items-center gap-2' });
      const descInput = el('input', {
        type: 'text',
        value: ex.desc,
        class: 'flex-1 rounded-lg bg-cream/40 border border-gray-200 px-3 py-2 text-sm text-darkBlue focus:ring-2 focus:ring-terracotta focus:outline-none',
        placeholder: labels.expense_desc_placeholder || 'Description',
      });
      descInput.addEventListener('input', (e) => {
        ex.desc = e.target.value;
      });
      head.appendChild(descInput);

      const amountInput = el('input', {
        type: 'number',
        step: '0.01',
        min: '0',
        value: ex.amount,
        class: 'w-24 rounded-lg bg-cream/40 border border-gray-200 px-3 py-2 text-sm text-darkBlue text-right focus:ring-2 focus:ring-terracotta focus:outline-none',
      });
      amountInput.addEventListener('input', (e) => {
        ex.amount = parseFloat(e.target.value) || 0;
        renderResults();
      });
      head.appendChild(amountInput);

      const rmBtn = el('button', {
        type: 'button',
        class: 'text-gray-400 hover:text-terracotta',
        'aria-label': labels.remove || 'Remove',
      }, [el('span', { class: 'material-symbols-outlined text-base', text: 'close' })]);
      rmBtn.addEventListener('click', () => {
        expenses = expenses.filter((x) => x.id !== ex.id);
        renderExpenses();
        renderResults();
      });
      head.appendChild(rmBtn);
      row.appendChild(head);

      // Paid by + split between
      const controls = el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-3 text-xs' });

      // Paid by
      const paidByWrap = el('div');
      paidByWrap.appendChild(el('label', { class: 'block text-gray-500 font-semibold mb-1', text: labels.paid_by || 'Paid by' }));
      const select = el('select', {
        class: 'w-full rounded-lg bg-cream/40 border border-gray-200 px-3 py-2 text-darkBlue focus:ring-2 focus:ring-terracotta focus:outline-none',
      });
      people.forEach((p) => {
        const opt = el('option', { value: p.id, text: p.name });
        if (p.id === ex.paidBy) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', (e) => {
        ex.paidBy = e.target.value;
        renderResults();
      });
      paidByWrap.appendChild(select);
      controls.appendChild(paidByWrap);

      // Split between
      const splitWrap = el('div');
      splitWrap.appendChild(el('label', { class: 'block text-gray-500 font-semibold mb-1', text: labels.split_between || 'Split between' }));
      const chkWrap = el('div', { class: 'flex flex-wrap gap-2' });
      people.forEach((p) => {
        const lbl = el('label', { class: 'inline-flex items-center gap-1 text-darkBlue cursor-pointer' });
        const chk = el('input', { type: 'checkbox', class: 'accent-terracotta' });
        chk.checked = ex.participants.includes(p.id);
        chk.addEventListener('change', (e) => {
          if (e.target.checked) {
            if (!ex.participants.includes(p.id)) ex.participants.push(p.id);
          } else {
            ex.participants = ex.participants.filter((id) => id !== p.id);
          }
          renderResults();
        });
        lbl.appendChild(chk);
        lbl.appendChild(el('span', { text: p.name }));
        chkWrap.appendChild(lbl);
      });
      splitWrap.appendChild(chkWrap);
      controls.appendChild(splitWrap);

      row.appendChild(controls);
      node.appendChild(row);
    });
  }

  function renderResults() {
    const node = document.getElementById('ts-results');
    clear(node);

    if (!people.length || !expenses.length) {
      node.appendChild(el('p', { class: 'text-sm text-gray-400 italic', text: labels.empty_state || 'Add people and expenses to see who owes who.' }));
      return;
    }

    // Compute net balance for each person
    const balance = Object.fromEntries(people.map((p) => [p.id, 0]));
    let total = 0;
    for (const ex of expenses) {
      if (!ex.participants.length || !ex.paidBy) continue;
      const share = ex.amount / ex.participants.length;
      total += ex.amount;
      balance[ex.paidBy] = (balance[ex.paidBy] || 0) + ex.amount;
      for (const pid of ex.participants) {
        balance[pid] = (balance[pid] || 0) - share;
      }
    }

    // Minimum-transfer settlement
    const creditors = [];
    const debtors = [];
    for (const p of people) {
      const b = Math.round(balance[p.id] * 100) / 100;
      if (b > 0.005) creditors.push({ id: p.id, name: p.name, amount: b });
      else if (b < -0.005) debtors.push({ id: p.id, name: p.name, amount: -b });
    }
    const transfers = [];
    while (creditors.length && debtors.length) {
      const c = creditors[0];
      const d = debtors[0];
      const amt = Math.min(c.amount, d.amount);
      transfers.push({ from: d.name, to: c.name, amount: amt });
      c.amount -= amt;
      d.amount -= amt;
      if (c.amount < 0.005) creditors.shift();
      if (d.amount < 0.005) debtors.shift();
    }

    // Total row
    const totalRow = el('div', { class: 'bg-cream/60 rounded-xl p-4 mb-4 flex items-center justify-between' }, [
      el('span', { class: 'text-sm text-gray-500 font-semibold', text: labels.total || 'Total' }),
      el('span', { class: 'text-lg font-extrabold text-darkBlue', text: fmt.format(total) }),
    ]);
    node.appendChild(totalRow);

    // Per-person balances
    const bList = el('div', { class: 'space-y-2 mb-4' });
    people.forEach((p) => {
      const b = Math.round(balance[p.id] * 100) / 100;
      const positive = b > 0.005;
      const negative = b < -0.005;
      const color = positive
        ? 'text-emerald-600 bg-emerald-50'
        : negative
        ? 'text-red-600 bg-red-50'
        : 'text-gray-500 bg-gray-100';
      const sign = positive ? '+' : negative ? '' : '';
      const row = el('div', { class: 'flex items-center justify-between py-2 px-3 rounded-lg bg-white' }, [
        el('span', { class: 'text-sm text-darkBlue font-semibold', text: p.name }),
        el('span', { class: `text-sm font-bold px-2 py-0.5 rounded-full ${color}`, text: `${sign}${fmt.format(b)}` }),
      ]);
      bList.appendChild(row);
    });
    node.appendChild(bList);

    // Transfers
    if (transfers.length) {
      const transfersWrap = el('div');
      transfersWrap.appendChild(el('p', { class: 'text-xs font-bold text-gray-400 tracking-widest uppercase mb-3', text: labels.transfers || 'Settle up' }));
      const tList = el('div', { class: 'space-y-2' });
      transfers.forEach((t) => {
        const row = el('div', { class: 'flex items-center justify-between py-3 px-4 rounded-lg bg-terracotta/5 border border-terracotta/20' });
        const left = el('div', { class: 'flex items-center gap-2 text-sm' }, [
          el('span', { class: 'font-semibold text-darkBlue', text: t.from }),
          el('span', { class: 'material-symbols-outlined text-terracotta text-base', text: 'arrow_forward' }),
          el('span', { class: 'font-semibold text-darkBlue', text: t.to }),
        ]);
        const right = el('span', { class: 'text-sm font-extrabold text-terracotta', text: fmt.format(t.amount) });
        row.appendChild(left);
        row.appendChild(right);
        tList.appendChild(row);
      });
      transfersWrap.appendChild(tList);
      node.appendChild(transfersWrap);
    } else {
      node.appendChild(el('p', { class: 'text-sm text-sage font-medium text-center py-2', text: labels.all_settled || 'All settled! No transfers needed.' }));
    }
  }

  function addPerson() {
    const n = people.length + 1;
    people.push({ id: uid(), name: `${labels.person_placeholder || 'Person'} ${n}` });
    render();
  }

  function addExpense() {
    if (!people.length) return;
    expenses.push({
      id: uid(),
      desc: labels.new_expense || 'New expense',
      amount: 0,
      paidBy: people[0].id,
      participants: people.map((p) => p.id),
    });
    renderExpenses();
    renderResults();
  }

  // Init
  render();
})();
