(function () {
  "use strict";

  var STORAGE_KEY = "fcny_tourney_data_v2";
  var LEGACY_KEY = "fcny_tourney_data_v1";

  /* ---------- state ---------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function defaultAgeGroup(name) {
    return { id: uid(), name: name || "Age Group", teams: [], groups: [], bracket: { rounds: [] } };
  }

  function defaultState() {
    return { activeAgeGroupId: null, ageGroups: [] };
  }

  function normalizeState(parsed) {
    var ageGroups = Array.isArray(parsed && parsed.ageGroups) ? parsed.ageGroups : [];
    ageGroups.forEach(function (ag) {
      ag.id = ag.id || uid();
      ag.name = ag.name || "Age Group";
      ag.teams = Array.isArray(ag.teams) ? ag.teams : [];
      ag.groups = Array.isArray(ag.groups) ? ag.groups : [];
      ag.bracket = ag.bracket && typeof ag.bracket === "object" ? ag.bracket : { rounds: [] };
      ag.bracket.rounds = Array.isArray(ag.bracket.rounds) ? ag.bracket.rounds : [];
    });
    var activeId = parsed && parsed.activeAgeGroupId;
    var activeExists = ageGroups.some(function (a) { return a.id === activeId; });
    return {
      activeAgeGroupId: activeExists ? activeId : (ageGroups[0] ? ageGroups[0].id : null),
      ageGroups: ageGroups
    };
  }

  function migrateLegacy(legacy) {
    var ag = defaultAgeGroup("Division 1");
    ag.teams = Array.isArray(legacy.teams) ? legacy.teams : [];
    ag.groups = Array.isArray(legacy.groups) ? legacy.groups : [];
    ag.bracket = legacy.bracket && typeof legacy.bracket === "object" ? legacy.bracket : { rounds: [] };
    ag.bracket.rounds = Array.isArray(ag.bracket.rounds) ? ag.bracket.rounds : [];
    return { activeAgeGroupId: ag.id, ageGroups: [ag] };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
      var legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        var migrated = migrateLegacy(JSON.parse(legacyRaw));
        // Write the migrated copy BEFORE dropping the legacy key. Dropping it
        // first leaves the only copy in memory, so opening the app and closing
        // it without editing anything (nothing calls save()) loses everything.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
    } catch (e) { /* fall through to default */ }
    return defaultState();
  }

  var state = load();
  var activeGroupId = null; // group detail sub-view within the current age group's Groups tab

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashSaved();
    } catch (e) {
      // Storage full or blocked. Everything since the last good save exists
      // only in memory, so this has to be loud rather than a grey status word.
      var ind = document.getElementById("saveIndicator");
      if (ind) {
        ind.textContent = "NOT SAVED";
        ind.classList.add("save-failed");
      }
    }
  }

  var flashTimer = null;
  function flashSaved() {
    var ind = document.getElementById("saveIndicator");
    if (!ind) return;
    ind.textContent = "Saved";
    ind.classList.remove("save-failed");
    ind.classList.add("flash");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      ind.classList.remove("flash");
    }, 600);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function currentAgeGroup() {
    return state.ageGroups.find(function (a) { return a.id === state.activeAgeGroupId; }) || null;
  }

  function teamName(ag, id) {
    if (!ag) return "";
    var t = ag.teams.find(function (x) { return x.id === id; });
    return t ? t.name : "(removed team)";
  }

  /* ---------- standings (shared by Groups tab + bracket standings-slots) ---------- */

  function computeStandingsArray(ag, group) {
    var table = {};
    group.teamIds.forEach(function (id) {
      table[id] = { id: id, name: teamName(ag, id), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
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

    return rows;
  }

  // A bracket slot can reference a fixed team ("<teamId>") or a live group
  // standings position ("std:<groupId>:<rank>") that resolves dynamically as
  // results come in, e.g. "Group A - 1st".
  function resolveTeamId(ag, ref) {
    if (!ref || !ag) return null;
    if (ref.indexOf("std:") === 0) {
      var parts = ref.split(":");
      var group = ag.groups.find(function (g) { return g.id === parts[1]; });
      if (!group) return null;
      var rank = parseInt(parts[2], 10);
      var rows = computeStandingsArray(ag, group);
      var row = rows[rank - 1];
      return row ? row.id : null;
    }
    return ref;
  }

  function resolveTeamLabel(ag, ref) {
    if (!ref) return "";
    if (ref.indexOf("std:") === 0) {
      var parts = ref.split(":");
      var group = ag.groups.find(function (g) { return g.id === parts[1]; });
      var rank = parseInt(parts[2], 10);
      var groupName = group ? group.name : "?";
      var actualId = resolveTeamId(ag, ref);
      var suffix = actualId ? teamName(ag, actualId) : "TBD";
      return groupName + " " + ordinal(rank) + " (" + suffix + ")";
    }
    return teamName(ag, ref);
  }

  /* ---------- tabs ---------- */

  var pages = ["ages", "teams", "groups", "bracket"];

  function showPage(name) {
    pages.forEach(function (p) {
      document.getElementById("page-" + p).classList.toggle("hidden", p !== name);
    });
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.page === name);
    });
    document.getElementById("activeBanner").classList.toggle("hidden", name === "ages");
  }

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showPage(btn.dataset.page);
    });
  });

  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-action="goto-ages"]')) {
      showPage("ages");
    }
  });

  /* ---------- ACTIVE AGE GROUP BANNER + gating ---------- */

  function renderActiveBanner() {
    var ag = currentAgeGroup();
    var text = document.getElementById("activeBannerText");
    text.textContent = ag ? ag.name : "No age group selected";

    var hasAg = !!ag;
    document.getElementById("teamsEmptyAgeGroup").classList.toggle("hidden", hasAg);
    document.getElementById("teamsContent").classList.toggle("hidden", !hasAg);
    document.getElementById("groupsEmptyAgeGroup").classList.toggle("hidden", hasAg);
    document.getElementById("groupsContent").classList.toggle("hidden", !hasAg);
    document.getElementById("bracketEmptyAgeGroup").classList.toggle("hidden", hasAg);
    document.getElementById("bracketContent").classList.toggle("hidden", !hasAg);
  }

  function renderAll() {
    renderActiveBanner();
    renderAgeGroups();
    renderTeams();
    renderGroupsIndex();
    if (activeGroupId) renderGroupDetail();
    renderBracket();
  }

  /* ---------- AGE GROUPS ---------- */

  function renderAgeGroups() {
    var ul = document.getElementById("ageGroupList");
    if (state.ageGroups.length === 0) {
      ul.innerHTML = '<li class="empty-hint" style="justify-content:center;">No age groups yet. Add one above (e.g. U10 Boys, U12 Girls, Open).</li>';
      return;
    }
    ul.innerHTML = state.ageGroups.map(function (ag) {
      var isActive = ag.id === state.activeAgeGroupId;
      return '<li data-id="' + ag.id + '">' +
        '<span class="name" data-action="select-ag" data-id="' + ag.id + '">' +
          escapeHtml(ag.name) +
          '<span class="ag-meta"> (' + ag.teams.length + ' teams, ' + ag.groups.length + ' groups)</span>' +
          (isActive ? '<span class="badge">Active</span>' : '') +
        '</span>' +
        '<button class="danger" data-action="delete-ag" data-id="' + ag.id + '">Remove</button>' +
        '</li>';
    }).join("");
  }

  document.getElementById("addAgeGroupForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("ageGroupNameInput");
    var name = input.value.trim();
    if (!name) return;
    var ag = defaultAgeGroup(name);
    state.ageGroups.push(ag);
    if (!state.activeAgeGroupId) state.activeAgeGroupId = ag.id;
    input.value = "";
    save();
    renderAll();
  });

  document.getElementById("ageGroupList").addEventListener("click", function (e) {
    var select = e.target.closest('[data-action="select-ag"]');
    if (select) {
      state.activeAgeGroupId = select.dataset.id;
      activeGroupId = null;
      document.getElementById("groupDetail").classList.add("hidden");
      document.getElementById("groupsIndex").classList.remove("hidden");
      save();
      renderAll();
      return;
    }
    var del = e.target.closest('[data-action="delete-ag"]');
    if (del) {
      var id = del.dataset.id;
      var doomed = state.ageGroups.find(function (a) { return a.id === id; });
      if (!doomed) return;
      if (!confirm('Remove "' + doomed.name + '" and everything in it (' +
        doomed.teams.length + ' teams, ' + doomed.groups.length + ' groups, and its bracket)?')) return;
      state.ageGroups = state.ageGroups.filter(function (a) { return a.id !== id; });
      if (state.activeAgeGroupId === id) {
        state.activeAgeGroupId = state.ageGroups[0] ? state.ageGroups[0].id : null;
        activeGroupId = null;
      }
      save();
      renderAll();
    }
  });

  /* ---------- BACKUP / RESTORE ---------- */

  document.getElementById("exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "fcny-tourney-backup-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById("importBtn").addEventListener("click", function () {
    document.getElementById("importFile").click();
  });

  document.getElementById("importFile").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.ageGroups)) throw new Error("bad format");
      } catch (err) {
        alert("That file doesn't look like a valid FCNY Tourney backup.");
        e.target.value = "";
        return;
      }
      if (!confirm("Restore this backup? This replaces all current data on this device.")) {
        e.target.value = "";
        return;
      }
      state = normalizeState(parsed);
      activeGroupId = null;
      save();
      renderAll();
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  /* ---------- TEAMS ---------- */

  function renderTeams() {
    var ag = currentAgeGroup();
    var ul = document.getElementById("teamList");
    if (!ag) { ul.innerHTML = ""; return; }
    if (ag.teams.length === 0) {
      ul.innerHTML = '<li class="empty-hint" style="justify-content:center;">No teams yet. Add one above.</li>';
      return;
    }
    ul.innerHTML = ag.teams.map(function (t) {
      return '<li data-id="' + t.id + '">' +
        '<span class="name">' + escapeHtml(t.name) + '</span>' +
        '<button class="danger" data-action="delete-team" data-id="' + t.id + '">Remove</button>' +
        '</li>';
    }).join("");
  }

  document.getElementById("addTeamForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var ag = currentAgeGroup();
    if (!ag) return;
    var input = document.getElementById("teamNameInput");
    var name = input.value.trim();
    if (!name) return;
    ag.teams.push({ id: uid(), name: name });
    input.value = "";
    save();
    renderTeams();
    renderGroupsIndex();
    if (activeGroupId) renderGroupDetail();
    renderBracket();
    renderAgeGroups();
  });

  document.getElementById("teamList").addEventListener("click", function (e) {
    var ag = currentAgeGroup();
    if (!ag) return;
    var btn = e.target.closest('[data-action="delete-team"]');
    if (!btn) return;
    var id = btn.dataset.id;
    if (!confirm("Remove this team? It will be removed from any groups and matches too.")) return;
    ag.teams = ag.teams.filter(function (t) { return t.id !== id; });
    ag.groups.forEach(function (g) {
      g.teamIds = g.teamIds.filter(function (tid) { return tid !== id; });
      g.matches = g.matches.filter(function (m) { return m.homeId !== id && m.awayId !== id; });
    });
    ag.bracket.rounds.forEach(function (r) {
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
    renderAgeGroups();
  });

  /* ---------- GROUPS ---------- */

  function renderGroupsIndex() {
    var ag = currentAgeGroup();
    var ul = document.getElementById("groupList");
    if (!ag) { ul.innerHTML = ""; return; }
    if (ag.groups.length === 0) {
      ul.innerHTML = '<li class="empty-hint" style="justify-content:center;">No groups yet. Add one above.</li>';
      return;
    }
    ul.innerHTML = ag.groups.map(function (g) {
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
    var ag = currentAgeGroup();
    if (!ag) return;
    var input = document.getElementById("groupNameInput");
    var name = input.value.trim();
    if (!name) return;
    ag.groups.push({ id: uid(), name: name, teamIds: [], matches: [] });
    input.value = "";
    save();
    renderGroupsIndex();
    renderAgeGroups();
  });

  document.getElementById("groupList").addEventListener("click", function (e) {
    var ag = currentAgeGroup();
    if (!ag) return;
    var open = e.target.closest('[data-action="open-group"]');
    if (open) {
      openGroup(open.dataset.id);
      return;
    }
    var del = e.target.closest('[data-action="delete-group"]');
    if (del) {
      if (!confirm("Delete this group and all its results?")) return;
      ag.groups = ag.groups.filter(function (g) { return g.id !== del.dataset.id; });
      save();
      renderGroupsIndex();
      renderAgeGroups();
      renderBracket();
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

  function currentGroup(ag) {
    if (!ag) return null;
    return ag.groups.find(function (g) { return g.id === activeGroupId; });
  }

  function renderGroupDetail() {
    var ag = currentAgeGroup();
    if (!ag) return;
    var group = currentGroup(ag);
    if (!group) {
      activeGroupId = null;
      document.getElementById("groupDetail").classList.add("hidden");
      document.getElementById("groupsIndex").classList.remove("hidden");
      renderGroupsIndex();
      return;
    }

    document.getElementById("groupDetailName").textContent = group.name;

    var assignWrap = document.getElementById("groupTeamAssign");
    if (ag.teams.length === 0) {
      assignWrap.innerHTML = '<span class="empty-hint">Add teams in the Teams tab first.</span>';
    } else {
      assignWrap.innerHTML = ag.teams.map(function (t) {
        var selected = group.teamIds.indexOf(t.id) !== -1;
        return '<span class="chip' + (selected ? " selected" : "") + '" data-action="toggle-team" data-id="' + t.id + '">' +
          escapeHtml(t.name) + '</span>';
      }).join("");
    }

    var teamListEl = document.getElementById("groupTeamList");
    if (group.teamIds.length === 0) {
      teamListEl.innerHTML = '<li class="empty-hint" style="justify-content:center;">No teams assigned yet.</li>';
    } else {
      teamListEl.innerHTML = group.teamIds.map(function (tid) {
        return '<li><span class="name">' + escapeHtml(teamName(ag, tid)) + '</span>' +
          '<button class="danger" data-action="remove-team-from-group" data-id="' + tid + '">Remove</button></li>';
      }).join("");
    }

    renderStandings(ag, group);
    renderMatchForm(ag, group);
    renderMatchList(ag, group);
  }

  document.getElementById("groupTeamAssign").addEventListener("click", function (e) {
    var ag = currentAgeGroup();
    var group = currentGroup(ag);
    if (!group) return;
    var chip = e.target.closest('[data-action="toggle-team"]');
    if (!chip) return;
    var id = chip.dataset.id;
    var idx = group.teamIds.indexOf(id);
    if (idx === -1) group.teamIds.push(id);
    else {
      group.teamIds.splice(idx, 1);
      group.matches = group.matches.filter(function (m) { return m.homeId !== id && m.awayId !== id; });
    }
    save();
    renderGroupDetail();
    renderAgeGroups();
    renderBracket();
  });

  document.getElementById("groupTeamList").addEventListener("click", function (e) {
    var ag = currentAgeGroup();
    var group = currentGroup(ag);
    if (!group) return;
    var btn = e.target.closest('[data-action="remove-team-from-group"]');
    if (!btn) return;
    var id = btn.dataset.id;
    group.teamIds = group.teamIds.filter(function (tid) { return tid !== id; });
    group.matches = group.matches.filter(function (m) { return m.homeId !== id && m.awayId !== id; });
    save();
    renderGroupDetail();
    renderBracket();
  });

  function renderStandings(ag, group) {
    var body = document.getElementById("standingsBody");
    var rows = computeStandingsArray(ag, group);

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

  function renderMatchForm(ag, group) {
    var homeSel = document.getElementById("matchHome");
    var awaySel = document.getElementById("matchAway");
    var options = group.teamIds.map(function (id) {
      return '<option value="' + id + '">' + escapeHtml(teamName(ag, id)) + "</option>";
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
    var ag = currentAgeGroup();
    var group = currentGroup(ag);
    if (!group) return;
    var homeId = document.getElementById("matchHome").value;
    var awayId = document.getElementById("matchAway").value;
    var homeScoreRaw = document.getElementById("matchHomeScore").value;
    var awayScoreRaw = document.getElementById("matchAwayScore").value;

    if (!homeId || !awayId) return;
    if (homeId === awayId) { alert("Pick two different teams."); return; }

    var homeScore = homeScoreRaw === "" ? null : Math.max(0, parseInt(homeScoreRaw, 10) || 0);
    var awayScore = awayScoreRaw === "" ? null : Math.max(0, parseInt(awayScoreRaw, 10) || 0);

    group.matches.push({ id: uid(), homeId: homeId, awayId: awayId, homeScore: homeScore, awayScore: awayScore });

    e.target.reset();
    save();
    renderStandings(ag, group);
    renderMatchList(ag, group);
    renderBracket();
  });

  function renderMatchList(ag, group) {
    var ul = document.getElementById("matchList");
    if (group.matches.length === 0) {
      ul.innerHTML = '<li class="empty-hint" style="justify-content:center;">No results yet.</li>';
      return;
    }
    ul.innerHTML = group.matches.slice().reverse().map(function (m) {
      var played = m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
      return '<li class="match-row" data-id="' + m.id + '">' +
        '<div class="match-line">' +
          '<span class="match-team">' + escapeHtml(teamName(ag, m.homeId)) + '</span>' +
          '<span class="match-score">' + (played ? m.homeScore + " - " + m.awayScore : "vs") + '</span>' +
          '<span class="match-team" style="text-align:right;">' + escapeHtml(teamName(ag, m.awayId)) + '</span>' +
        '</div>' +
        '<div class="match-actions">' +
          '<button class="icon-btn" data-action="edit-match" data-id="' + m.id + '" title="Edit score">Edit</button>' +
          '<button class="danger" data-action="delete-match" data-id="' + m.id + '">Delete</button>' +
        '</div>' +
      '</li>';
    }).join("");
  }

  document.getElementById("matchList").addEventListener("click", function (e) {
    var ag = currentAgeGroup();
    var group = currentGroup(ag);
    if (!group) return;

    var editBtn = e.target.closest('[data-action="edit-match"]');
    if (editBtn) {
      var match = group.matches.find(function (m) { return m.id === editBtn.dataset.id; });
      if (!match) return;
      var hs = prompt(teamName(ag, match.homeId) + " score:", match.homeScore === null || match.homeScore === undefined ? "" : match.homeScore);
      if (hs === null) return;
      var as = prompt(teamName(ag, match.awayId) + " score:", match.awayScore === null || match.awayScore === undefined ? "" : match.awayScore);
      if (as === null) return;
      match.homeScore = hs.trim() === "" ? null : Math.max(0, parseInt(hs, 10) || 0);
      match.awayScore = as.trim() === "" ? null : Math.max(0, parseInt(as, 10) || 0);
      save();
      renderStandings(ag, group);
      renderMatchList(ag, group);
      renderBracket();
      return;
    }

    var delBtn = e.target.closest('[data-action="delete-match"]');
    if (delBtn) {
      if (!confirm("Delete this result?")) return;
      group.matches = group.matches.filter(function (m) { return m.id !== delBtn.dataset.id; });
      save();
      renderStandings(ag, group);
      renderMatchList(ag, group);
      renderBracket();
    }
  });

  /* ---------- BRACKET ---------- */

  document.getElementById("addRoundForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var ag = currentAgeGroup();
    if (!ag) return;
    var input = document.getElementById("roundNameInput");
    var name = input.value.trim();
    if (!name) return;
    ag.bracket.rounds.push({ id: uid(), name: name, matches: [] });
    input.value = "";
    save();
    renderBracket();
  });

  function teamOptions(ag, selectedRef) {
    var placeholder = '<option value="">Select team</option>';
    var directOpts = ag.teams.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === selectedRef ? " selected" : "") + '>' + escapeHtml(t.name) + "</option>";
    }).join("");

    var groupOptsHtml = "";
    ag.groups.forEach(function (g) {
      if (g.teamIds.length === 0) return;
      var opts = g.teamIds.map(function (_, idx) {
        var rank = idx + 1;
        var ref = "std:" + g.id + ":" + rank;
        var label = resolveTeamLabel(ag, ref);
        return '<option value="' + ref + '"' + (ref === selectedRef ? " selected" : "") + '>' + escapeHtml(label) + "</option>";
      }).join("");
      groupOptsHtml += '<optgroup label="' + escapeHtml(g.name) + ' standings">' + opts + "</optgroup>";
    });

    return placeholder +
      (directOpts ? '<optgroup label="Teams">' + directOpts + "</optgroup>" : "") +
      groupOptsHtml;
  }

  function computeWinner(ag, m) {
    var t1 = resolveTeamId(ag, m.team1Id);
    var t2 = resolveTeamId(ag, m.team2Id);
    if (!t1 || !t2 || t1 === t2) return null;
    // A manually picked winner only stands while it still names one of the two
    // teams actually in the match. A standings slot can re-resolve to someone
    // else after a group score changes, and the old pick must not survive that.
    if (m.winnerId) return (m.winnerId === t1 || m.winnerId === t2) ? m.winnerId : null;
    if (m.score1 !== null && m.score1 !== undefined &&
        m.score2 !== null && m.score2 !== undefined && m.score1 !== m.score2) {
      return m.score1 > m.score2 ? t1 : t2;
    }
    return null;
  }

  function isSameTeamBothSides(ag, m) {
    var t1 = resolveTeamId(ag, m.team1Id);
    var t2 = resolveTeamId(ag, m.team2Id);
    return !!(t1 && t2 && t1 === t2);
  }

  function isDrawMatch(m) {
    return !!(m.team1Id && m.team2Id && m.score1 !== null && m.score1 !== undefined &&
      m.score2 !== null && m.score2 !== undefined && m.score1 === m.score2);
  }

  function drawPickerHtmlFor(ag, roundId, m) {
    var t1 = resolveTeamId(ag, m.team1Id);
    var t2 = resolveTeamId(ag, m.team2Id);
    if (!t1 || !t2 || t1 === t2) return "";
    return '<span class="bracket-name" style="color:var(--draw);">Tied. Pick a winner:</span>' +
      '<select data-field="winnerId" data-round="' + roundId + '" data-match="' + m.id + '">' +
        '<option value="">--</option>' +
        '<option value="' + t1 + '"' + (m.winnerId === t1 ? " selected" : "") + '>' + escapeHtml(teamName(ag, t1)) + '</option>' +
        '<option value="' + t2 + '"' + (m.winnerId === t2 ? " selected" : "") + '>' + escapeHtml(teamName(ag, t2)) + '</option>' +
      '</select>';
  }

  // Updates winner highlighting / draw-picker for one matchup in place, without
  // rebuilding its DOM. Rebuilding would blow away focus on an input the
  // person is still typing into (e.g. right after entering the first score).
  function updateMatchVisual(ag, round, m) {
    var matchEl = document.querySelector('.bracket-match[data-match="' + m.id + '"]');
    if (!matchEl) return;
    var slots = matchEl.querySelectorAll(".bracket-slot");
    var winnerId = computeWinner(ag, m);
    var t1 = resolveTeamId(ag, m.team1Id);
    var t2 = resolveTeamId(ag, m.team2Id);
    slots[0].classList.toggle("winner", !!winnerId && winnerId === t1);
    slots[1].classList.toggle("winner", !!winnerId && winnerId === t2);

    var pickerSlot = matchEl.querySelector(".draw-picker-slot");
    var draw = isDrawMatch(m);
    if (pickerSlot) {
      pickerSlot.style.display = draw ? "" : "none";
      pickerSlot.innerHTML = draw ? drawPickerHtmlFor(ag, round.id, m) : "";
    }

    var warnEl = matchEl.querySelector(".match-warn");
    if (warnEl) warnEl.style.display = isSameTeamBothSides(ag, m) ? "" : "none";
  }

  function renderBracket() {
    var ag = currentAgeGroup();
    var wrap = document.getElementById("bracketWrap");
    if (!ag) { wrap.innerHTML = ""; return; }

    if (ag.bracket.rounds.length === 0) {
      wrap.innerHTML = '<p class="empty-hint">No rounds yet. Add a round above (e.g. Quarterfinal, Semifinal, Final) to start your bracket.</p>';
      return;
    }

    wrap.innerHTML = ag.bracket.rounds.map(function (round) {
      var matchesHtml = round.matches.map(function (m) {
        var winnerId = computeWinner(ag, m);
        var t1 = resolveTeamId(ag, m.team1Id);
        var t2 = resolveTeamId(ag, m.team2Id);
        var isDraw = isDrawMatch(m);
        var sameTeam = isSameTeamBothSides(ag, m);

        return '<div class="bracket-match" data-round="' + round.id + '" data-match="' + m.id + '">' +
          '<div class="bracket-slot' + (winnerId && winnerId === t1 ? " winner" : "") + '">' +
            '<select data-field="team1Id" data-round="' + round.id + '" data-match="' + m.id + '">' + teamOptions(ag, m.team1Id) + '</select>' +
            '<input type="number" min="0" inputmode="numeric" placeholder="-" data-field="score1" data-round="' + round.id + '" data-match="' + m.id + '" value="' + (m.score1 === null || m.score1 === undefined ? "" : m.score1) + '">' +
          '</div>' +
          '<div class="bracket-vs">vs</div>' +
          '<div class="bracket-slot' + (winnerId && winnerId === t2 ? " winner" : "") + '">' +
            '<select data-field="team2Id" data-round="' + round.id + '" data-match="' + m.id + '">' + teamOptions(ag, m.team2Id) + '</select>' +
            '<input type="number" min="0" inputmode="numeric" placeholder="-" data-field="score2" data-round="' + round.id + '" data-match="' + m.id + '" value="' + (m.score2 === null || m.score2 === undefined ? "" : m.score2) + '">' +
          '</div>' +
          '<div class="draw-picker-slot"' + (isDraw ? '' : ' style="display:none;"') + '>' +
            drawPickerHtmlFor(ag, round.id, m) +
          '</div>' +
          '<div class="match-warn"' + (sameTeam ? '' : ' style="display:none;"') + '>Same team on both sides.</div>' +
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
    var ag = currentAgeGroup();
    if (!ag) return;

    var addBtn = e.target.closest('[data-action="add-bmatch"]');
    if (addBtn) {
      var round = ag.bracket.rounds.find(function (r) { return r.id === addBtn.dataset.round; });
      if (!round) return;
      round.matches.push({ id: uid(), team1Id: null, team2Id: null, score1: null, score2: null, winnerId: null });
      save();
      renderBracket();
      return;
    }

    var delMatch = e.target.closest('[data-action="delete-bmatch"]');
    if (delMatch) {
      var r2 = ag.bracket.rounds.find(function (r) { return r.id === delMatch.dataset.round; });
      if (!r2) return;
      if (!confirm("Delete this matchup?")) return;
      r2.matches = r2.matches.filter(function (m) { return m.id !== delMatch.dataset.match; });
      save();
      renderBracket();
      return;
    }

    var delRound = e.target.closest('[data-action="delete-round"]');
    if (delRound) {
      if (!confirm("Remove this round and its matchups?")) return;
      ag.bracket.rounds = ag.bracket.rounds.filter(function (r) { return r.id !== delRound.dataset.round; });
      save();
      renderBracket();
    }
  });

  document.getElementById("bracketWrap").addEventListener("change", function (e) {
    var ag = currentAgeGroup();
    if (!ag) return;
    var field = e.target.dataset.field;
    if (!field) return;
    var round = ag.bracket.rounds.find(function (r) { return r.id === e.target.dataset.round; });
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
    // Targeted update only. A full renderBracket() here would tear down and
    // recreate every input/select in the bracket, which can steal focus from
    // (or blank out) a field the person is about to tap into next.
    updateMatchVisual(ag, round, match);
  });

  /* ---------- init ---------- */

  renderAll();
  showPage("ages");
})();
