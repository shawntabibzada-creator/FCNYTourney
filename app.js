(function () {
  "use strict";

  var STORAGE_KEY = "fcny_tourney_data_v1";

  /* ---------- state ---------- */

  function defaultState() {
    return {
      teams: [],       // {id, name}
      groups: [],      // {id, name, teamIds: [], matches: [{id, homeId, awayId, homeScore, awayScore}]}
      bracket: { rounds: [] } // rounds: [{id, name, matches: [{id, team1Id, team2Id, score1, score2, winnerId}]}]
    };
  }

  var state = load();
  var activeGroupId = null;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var d = defaultState();
      return {
        teams: parsed.teams || d.teams,
        groups: parsed.groups || d.groups,
        bracket: parsed.bracket || d.bracket
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashSaved();
    } catch (e) {
      var ind = document.getElementById("saveIndicator");
      if (ind) ind.textContent = "Save failed";
    }
  }

  var flashTimer = null;
  function flashSaved() {
    var ind = document.getElementById("saveIndicator");
    if (!ind) return;
    ind.textContent = "Saved";
    ind.classList.add("flash");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      ind.classList.remove("flash");
    }, 600);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function teamName(id) {
    var t = state.teams.find(function (x) { return x.id === id; });
    return t ? t.name : "(removed team)";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- tabs ---------- */

  var pages = ["teams", "groups", "bracket"];

  function showPage(name) {
    pages.forEach(function (p) {
      document.getElementById("page-" + p).classList.toggle("hidden", p !== name);
    });
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.page === name);
    });
  }

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showPage(btn.dataset.page);
    });
  });

  /* ---------- TEAMS ---------- */

  function renderTeams() {
    var ul = document.getElementById("teamList");
    if (state.teams.length === 0) {
      ul.innerHTML = '<li class="empty-hint" style="justify-content:center;">No teams yet. Add one above.</li>';
      return;
    }
    ul.innerHTML = state.teams.map(function (t) {
      return '<li data-id="' + t.id + '">' +
        '<span class="name">' + escapeHtml(t.name) + '</span>' +
        '<button class="danger" data-action="delete-team" data-id="' + t.id + '">Remove</button>' +
        '</li>';
    }).join("");
  }

  document.getElementById("addTeamForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("teamNameInput");
    var name = input.value.trim();
    if (!name) return;
    state.teams.push({ id: uid(), name: name });
    input.value = "";
    save();
    renderTeams();
    renderGroupsIndex();
    if (activeGroupId) renderGroupDetail();
    renderBracket();
  });

  document.getElementById("teamList").addEventListener("click", function (e) {
    var btn = e.target.closest('[data-action="delete-team"]');
    if (!btn) return;
    var id = btn.dataset.id;
    if (!confirm("Remove this team? It will be removed from any groups and matches too.")) return;
    state.teams = state.teams.filter(function (t) { return t.id !== id; });
    state.groups.forEach(function (g) {
      g.teamIds = g.teamIds.filter(function (tid) { return tid !== id; });
      g.matches = g.matches.filter(function (m) { return m.homeId !== id && m.awayId !== id; });
    });
    state.bracket.rounds.forEach(function (r) {
      r.matches.forEach(function (m) {
        if (m.team1Id === id) m.team1Id = null;
        if (m.team2Id === id) m.team2Id = null;
        if (m.winnerId === id) m.winnerId = null;
      });
    });
    save();
    renderTeams();
    renderGroupsIndex();
    if (activeGroupId) renderGroupDetail();
    renderBracket();
  });

  /* ---------- GROUPS ---------- */

  function renderGroupsIndex() {
    var ul = document.getElementById("groupList");
    if (state.groups.length === 0) {
      ul.innerHTML = '<li class="empty-hint" style="justify-content:center;">No groups yet. Add one above.</li>';
      return;
    }
    ul.innerHTML = state.groups.map(function (g) {
      return '<li data-id="' + g.id + '">' +
        '<span class="name" data-action="open-group" data-id="' + g.id + '">' +
          escapeHtml(g.name) + ' <span style="color:var(--text-dim);font-weight:400;">(' + g.teamIds.length + ' teams)</span>' +
        '</span>' +
        '<button class="danger" data-action="delete-group" data-id="' + g.id + '">Remove</button>' +
        '</li>';
    }).join("");
  }

  document.getElementById("addGroupForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("groupNameInput");
    var name = input.value.trim();
    if (!name) return;
    state.groups.push({ id: uid(), name: name, teamIds: [], matches: [] });
    input.value = "";
    save();
    renderGroupsIndex();
  });

  document.getElementById("groupList").addEventListener("click", function (e) {
    var open = e.target.closest('[data-action="open-group"]');
    if (open) {
      openGroup(open.dataset.id);
      return;
    }
    var del = e.target.closest('[data-action="delete-group"]');
    if (del) {
      if (!confirm("Delete this group and all its results?")) return;
      state.groups = state.groups.filter(function (g) { return g.id !== del.dataset.id; });
      save();
      renderGroupsIndex();
    }
  });

  function openGroup(id) {
    activeGroupId = id;
    document.getElementById("groupsIndex").classList.add("hidden");
    document.getElementById("groupDetail").classList.remove("hidden");
    renderGroupDetail();
  }

  document.getElementById("backToGroups").addEventListener("click", function () {
    activeGroupId = null;
    document.getElementById("groupDetail").classList.add("hidden");
    document.getElementById("groupsIndex").classList.remove("hidden");
    renderGroupsIndex();
  });

  function currentGroup() {
    return state.groups.find(function (g) { return g.id === activeGroupId; });
  }

  function renderGroupDetail() {
    var group = currentGroup();
    if (!group) {
      activeGroupId = null;
      document.getElementById("groupDetail").classList.add("hidden");
      document.getElementById("groupsIndex").classList.remove("hidden");
      renderGroupsIndex();
      return;
    }

    document.getElementById("groupDetailName").textContent = group.name;

    // team assignment chips
    var assignWrap = document.getElementById("groupTeamAssign");
    if (state.teams.length === 0) {
      assignWrap.innerHTML = '<span class="empty-hint">Add teams in the Teams tab first.</span>';
    } else {
      assignWrap.innerHTML = state.teams.map(function (t) {
        var selected = group.teamIds.indexOf(t.id) !== -1;
        return '<span class="chip' + (selected ? " selected" : "") + '" data-action="toggle-team" data-id="' + t.id + '">' +
          escapeHtml(t.name) + '</span>';
      }).join("");
    }

    // team list in group
    var teamListEl = document.getElementById("groupTeamList");
    if (group.teamIds.length === 0) {
      teamListEl.innerHTML = '<li class="empty-hint" style="justify-content:center;">No teams assigned yet.</li>';
    } else {
      teamListEl.innerHTML = group.teamIds.map(function (tid) {
        return '<li><span class="name">' + escapeHtml(teamName(tid)) + '</span>' +
          '<button class="danger" data-action="remove-team-from-group" data-id="' + tid + '">Remove</button></li>';
      }).join("");
    }

    renderStandings(group);
    renderMatchForm(group);
    renderMatchList(group);
  }

  document.getElementById("groupTeamAssign").addEventListener("click", function (e) {
    var chip = e.target.closest('[data-action="toggle-team"]');
    if (!chip) return;
    var group = currentGroup();
    if (!group) return;
    var id = chip.dataset.id;
    var idx = group.teamIds.indexOf(id);
    if (idx === -1) group.teamIds.push(id);
    else {
      group.teamIds.splice(idx, 1);
      group.matches = group.matches.filter(function (m) { return m.homeId !== id && m.awayId !== id; });
    }
    save();
    renderGroupDetail();
  });

  document.getElementById("groupTeamList").addEventListener("click", function (e) {
    var btn = e.target.closest('[data-action="remove-team-from-group"]');
    if (!btn) return;
    var group = currentGroup();
    if (!group) return;
    var id = btn.dataset.id;
    group.teamIds = group.teamIds.filter(function (tid) { return tid !== id; });
    group.matches = group.matches.filter(function (m) { return m.homeId !== id && m.awayId !== id; });
    save();
    renderGroupDetail();
  });

  function renderStandings(group) {
    var body = document.getElementById("standingsBody");
    var table = {};
    group.teamIds.forEach(function (id) {
      table[id] = { id: id, name: teamName(id), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    });

    group.matches.forEach(function (m) {
      if (m.homeScore === null || m.homeScore === undefined || m.awayScore === null || m.awayScore === undefined) return;
      var h = table[m.homeId], a = table[m.awayId];
      if (!h || !a) return;
      var hs = Number(m.homeScore), as = Number(m.awayScore);
      h.p++; a.p++;
      h.gf += hs; h.ga += as;
      a.gf += as; a.ga += hs;
      if (hs > as) { h.w++; h.pts += 3; a.l++; }
      else if (hs < as) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
    });

    var rows = Object.keys(table).map(function (id) {
      var r = table[id];
      r.gd = r.gf - r.ga;
      return r;
    });

    rows.sort(function (x, y) {
      if (y.pts !== x.pts) return y.pts - x.pts;
      if (y.gd !== x.gd) return y.gd - x.gd;
      if (y.gf !== x.gf) return y.gf - x.gf;
      return x.name.localeCompare(y.name);
    });

    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="9" class="empty-hint">No teams assigned yet.</td></tr>';
      return;
    }

    body.innerHTML = rows.map(function (r) {
      return "<tr>" +
        '<td class="col-team">' + escapeHtml(r.name) + "</td>" +
        "<td>" + r.p + "</td><td>" + r.w + "</td><td>" + r.d + "</td><td>" + r.l + "</td>" +
        "<td>" + r.gf + "</td><td>" + r.ga + "</td><td>" + (r.gd > 0 ? "+" : "") + r.gd + "</td>" +
        '<td class="pts">' + r.pts + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderMatchForm(group) {
    var homeSel = document.getElementById("matchHome");
    var awaySel = document.getElementById("matchAway");
    var options = group.teamIds.map(function (id) {
      return '<option value="' + id + '">' + escapeHtml(teamName(id)) + "</option>";
    }).join("");
    var placeholder = '<option value="" disabled selected>Team</option>';
    homeSel.innerHTML = placeholder + options;
    awaySel.innerHTML = placeholder + options;

    var form = document.getElementById("addMatchForm");
    var hasEnoughTeams = group.teamIds.length >= 2;
    Array.prototype.forEach.call(form.elements, function (el) { el.disabled = !hasEnoughTeams; });
  }

  document.getElementById("addMatchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var group = currentGroup();
    if (!group) return;
    var homeId = document.getElementById("matchHome").value;
    var awayId = document.getElementById("matchAway").value;
    var homeScoreRaw = document.getElementById("matchHomeScore").value;
    var awayScoreRaw = document.getElementById("matchAwayScore").value;

    if (!homeId || !awayId) return;
    if (homeId === awayId) { alert("Pick two different teams."); return; }

    var homeScore = homeScoreRaw === "" ? null : Math.max(0, parseInt(homeScoreRaw, 10));
    var awayScore = awayScoreRaw === "" ? null : Math.max(0, parseInt(awayScoreRaw, 10));

    group.matches.push({ id: uid(), homeId: homeId, awayId: awayId, homeScore: homeScore, awayScore: awayScore });

    e.target.reset();
    save();
    renderStandings(group);
    renderMatchList(group);
  });

  function renderMatchList(group) {
    var ul = document.getElementById("matchList");
    if (group.matches.length === 0) {
      ul.innerHTML = '<li class="empty-hint" style="justify-content:center;">No results yet.</li>';
      return;
    }
    ul.innerHTML = group.matches.slice().reverse().map(function (m) {
      var played = m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
      return '<li class="match-row" data-id="' + m.id + '">' +
        '<div class="match-line">' +
          '<span class="match-team">' + escapeHtml(teamName(m.homeId)) + '</span>' +
          '<span class="match-score">' + (played ? m.homeScore + " - " + m.awayScore : "vs") + '</span>' +
          '<span class="match-team" style="text-align:right;">' + escapeHtml(teamName(m.awayId)) + '</span>' +
        '</div>' +
        '<div class="match-actions">' +
          '<button class="icon-btn" data-action="edit-match" data-id="' + m.id + '" title="Edit score">Edit</button>' +
          '<button class="danger" data-action="delete-match" data-id="' + m.id + '">Delete</button>' +
        '</div>' +
      '</li>';
    }).join("");
  }

  document.getElementById("matchList").addEventListener("click", function (e) {
    var group = currentGroup();
    if (!group) return;

    var editBtn = e.target.closest('[data-action="edit-match"]');
    if (editBtn) {
      var match = group.matches.find(function (m) { return m.id === editBtn.dataset.id; });
      if (!match) return;
      var hs = prompt(teamName(match.homeId) + " score:", match.homeScore === null || match.homeScore === undefined ? "" : match.homeScore);
      if (hs === null) return;
      var as = prompt(teamName(match.awayId) + " score:", match.awayScore === null || match.awayScore === undefined ? "" : match.awayScore);
      if (as === null) return;
      match.homeScore = hs.trim() === "" ? null : Math.max(0, parseInt(hs, 10) || 0);
      match.awayScore = as.trim() === "" ? null : Math.max(0, parseInt(as, 10) || 0);
      save();
      renderStandings(group);
      renderMatchList(group);
      return;
    }

    var delBtn = e.target.closest('[data-action="delete-match"]');
    if (delBtn) {
      if (!confirm("Delete this result?")) return;
      group.matches = group.matches.filter(function (m) { return m.id !== delBtn.dataset.id; });
      save();
      renderStandings(group);
      renderMatchList(group);
    }
  });

  /* ---------- BRACKET ---------- */

  document.getElementById("addRoundForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("roundNameInput");
    var name = input.value.trim();
    if (!name) return;
    state.bracket.rounds.push({ id: uid(), name: name, matches: [] });
    input.value = "";
    save();
    renderBracket();
  });

  function teamOptions(selectedId) {
    var placeholder = '<option value="">Select team</option>';
    var opts = state.teams.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === selectedId ? " selected" : "") + '>' + escapeHtml(t.name) + "</option>";
    }).join("");
    return placeholder + opts;
  }

  function computeWinner(m) {
    if (m.winnerId) return m.winnerId;
    if (m.team1Id && m.team2Id && m.score1 !== null && m.score1 !== undefined &&
        m.score2 !== null && m.score2 !== undefined && m.score1 !== m.score2) {
      return m.score1 > m.score2 ? m.team1Id : m.team2Id;
    }
    return null;
  }

  function isDrawMatch(m) {
    return !!(m.team1Id && m.team2Id && m.score1 !== null && m.score1 !== undefined &&
      m.score2 !== null && m.score2 !== undefined && m.score1 === m.score2);
  }

  function drawPickerHtml(roundId, m) {
    if (!m.team1Id || !m.team2Id) return "";
    return '<span class="bracket-name" style="color:var(--draw);">Draw &mdash; pick winner:</span>' +
      '<select data-field="winnerId" data-round="' + roundId + '" data-match="' + m.id + '">' +
        '<option value="">--</option>' +
        '<option value="' + m.team1Id + '"' + (m.winnerId === m.team1Id ? " selected" : "") + '>' + escapeHtml(teamName(m.team1Id)) + '</option>' +
        '<option value="' + m.team2Id + '"' + (m.winnerId === m.team2Id ? " selected" : "") + '>' + escapeHtml(teamName(m.team2Id)) + '</option>' +
      '</select>';
  }

  // Updates winner highlighting / draw-picker for one matchup in place, without
  // rebuilding its DOM — rebuilding would blow away focus on an input the
  // person is still typing into (e.g. right after entering the first score).
  function updateMatchVisual(round, m) {
    var matchEl = document.querySelector('.bracket-match[data-match="' + m.id + '"]');
    if (!matchEl) return;
    var slots = matchEl.querySelectorAll(".bracket-slot");
    var winnerId = computeWinner(m);
    slots[0].classList.toggle("winner", !!winnerId && winnerId === m.team1Id);
    slots[1].classList.toggle("winner", !!winnerId && winnerId === m.team2Id);

    var pickerSlot = matchEl.querySelector(".draw-picker-slot");
    var draw = isDrawMatch(m);
    if (pickerSlot) {
      pickerSlot.style.display = draw ? "" : "none";
      pickerSlot.innerHTML = draw ? drawPickerHtml(round.id, m) : "";
    }
  }

  function renderBracket() {
    var wrap = document.getElementById("bracketWrap");
    if (state.bracket.rounds.length === 0) {
      wrap.innerHTML = '<p class="empty-hint">No rounds yet. Add a round above (e.g. Quarterfinal, Semifinal, Final) to start your bracket.</p>';
      return;
    }

    wrap.innerHTML = state.bracket.rounds.map(function (round) {
      var matchesHtml = round.matches.map(function (m) {
        var winnerId = computeWinner(m);
        var isDraw = isDrawMatch(m);

        return '<div class="bracket-match" data-round="' + round.id + '" data-match="' + m.id + '">' +
          '<div class="bracket-slot' + (winnerId && winnerId === m.team1Id ? " winner" : "") + '">' +
            '<select data-field="team1Id" data-round="' + round.id + '" data-match="' + m.id + '">' + teamOptions(m.team1Id) + '</select>' +
            '<input type="number" min="0" inputmode="numeric" placeholder="-" data-field="score1" data-round="' + round.id + '" data-match="' + m.id + '" value="' + (m.score1 === null || m.score1 === undefined ? "" : m.score1) + '">' +
          '</div>' +
          '<div class="bracket-vs">vs</div>' +
          '<div class="bracket-slot' + (winnerId && winnerId === m.team2Id ? " winner" : "") + '">' +
            '<select data-field="team2Id" data-round="' + round.id + '" data-match="' + m.id + '">' + teamOptions(m.team2Id) + '</select>' +
            '<input type="number" min="0" inputmode="numeric" placeholder="-" data-field="score2" data-round="' + round.id + '" data-match="' + m.id + '" value="' + (m.score2 === null || m.score2 === undefined ? "" : m.score2) + '">' +
          '</div>' +
          '<div class="draw-picker-slot"' + (isDraw ? '' : ' style="display:none;"') + '>' +
            drawPickerHtml(round.id, m) +
          '</div>' +
          '<div class="match-actions">' +
            '<button class="danger" data-action="delete-bmatch" data-round="' + round.id + '" data-match="' + m.id + '">Delete matchup</button>' +
          '</div>' +
        '</div>';
      }).join("");

      return '<div class="round-block" data-round-id="' + round.id + '">' +
        '<div class="round-header"><h4>' + escapeHtml(round.name) + '</h4>' +
          '<button class="danger" data-action="delete-round" data-round="' + round.id + '">Remove round</button>' +
        '</div>' +
        matchesHtml +
        '<button class="add-match-btn" data-action="add-bmatch" data-round="' + round.id + '">+ Add matchup</button>' +
      '</div>';
    }).join("");
  }

  document.getElementById("bracketWrap").addEventListener("click", function (e) {
    var addBtn = e.target.closest('[data-action="add-bmatch"]');
    if (addBtn) {
      var round = state.bracket.rounds.find(function (r) { return r.id === addBtn.dataset.round; });
      if (!round) return;
      round.matches.push({ id: uid(), team1Id: null, team2Id: null, score1: null, score2: null, winnerId: null });
      save();
      renderBracket();
      return;
    }

    var delMatch = e.target.closest('[data-action="delete-bmatch"]');
    if (delMatch) {
      var r2 = state.bracket.rounds.find(function (r) { return r.id === delMatch.dataset.round; });
      if (!r2) return;
      r2.matches = r2.matches.filter(function (m) { return m.id !== delMatch.dataset.match; });
      save();
      renderBracket();
      return;
    }

    var delRound = e.target.closest('[data-action="delete-round"]');
    if (delRound) {
      if (!confirm("Remove this round and its matchups?")) return;
      state.bracket.rounds = state.bracket.rounds.filter(function (r) { return r.id !== delRound.dataset.round; });
      save();
      renderBracket();
    }
  });

  document.getElementById("bracketWrap").addEventListener("change", function (e) {
    var field = e.target.dataset.field;
    if (!field) return;
    var round = state.bracket.rounds.find(function (r) { return r.id === e.target.dataset.round; });
    if (!round) return;
    var match = round.matches.find(function (m) { return m.id === e.target.dataset.match; });
    if (!match) return;

    if (field === "score1" || field === "score2") {
      var v = e.target.value;
      match[field] = v === "" ? null : Math.max(0, parseInt(v, 10) || 0);
      match.winnerId = null; // recompute from score unless a draw override is chosen again
    } else if (field === "team1Id" || field === "team2Id") {
      match[field] = e.target.value || null;
      match.winnerId = null;
    } else if (field === "winnerId") {
      match.winnerId = e.target.value || null;
    }

    save();
    // Targeted update only — a full renderBracket() here would tear down and
    // recreate every input/select in the bracket, which can steal focus from
    // (or blank out) a field the person is about to tap into next.
    updateMatchVisual(round, match);
  });

  /* ---------- init ---------- */

  renderTeams();
  renderGroupsIndex();
  renderBracket();
  showPage("teams");
})();
