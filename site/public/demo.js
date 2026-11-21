// Example review card on the home page. It mirrors the consent step of the real
// widget (widget/src/components/MemoryReview.tsx) and sends nothing anywhere.
(function () {
  "use strict";

  var form = document.getElementById("review");
  var outcome = document.getElementById("outcome");
  if (!form || !outcome) return;

  var save = document.getElementById("save");
  var discard = document.getElementById("discard");
  var restart = document.getElementById("restart");
  var title = document.getElementById("outcome-title");
  var list = document.getElementById("outcome-list");
  var skipped = document.getElementById("outcome-skipped");
  var items = Array.prototype.slice.call(form.querySelectorAll(".memory"));

  function parts(item) {
    return {
      box: item.querySelector('input[type="checkbox"]'),
      state: item.querySelector(".check__state"),
      select: item.querySelector("select"),
    };
  }

  function kept() {
    return items.filter(function (item) {
      return parts(item).box.checked;
    });
  }

  function refresh() {
    items.forEach(function (item) {
      var p = parts(item);
      p.state.textContent = p.box.checked ? "Keep" : "Skip";
      p.select.disabled = !p.box.checked;
      item.classList.toggle("memory--off", !p.box.checked);
    });
    var n = kept().length;
    save.textContent = "Save selected (" + n + ")";
    save.disabled = n === 0;
  }

  function show(heading, rows, note) {
    title.textContent = heading;
    list.textContent = "";
    rows.forEach(function (row) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.className = "saved__title";
      name.textContent = row.title;
      var who = document.createElement("span");
      who.className = "tag";
      who.textContent = row.visibility;
      li.appendChild(name);
      li.appendChild(who);
      list.appendChild(li);
    });
    list.hidden = rows.length === 0;
    skipped.textContent = note;
    skipped.hidden = note === "";
    form.hidden = true;
    outcome.hidden = false;
    title.focus();
  }

  form.addEventListener("change", refresh);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var rows = kept().map(function (item) {
      var select = parts(item).select;
      return { title: item.getAttribute("data-title"), visibility: select.options[select.selectedIndex].text };
    });
    if (rows.length === 0) return;
    var left = items.length - rows.length;
    show(
      "Saved " + rows.length + (rows.length === 1 ? " memory" : " memories"),
      rows,
      left === 0 ? "" : left + " skipped. " + (left === 1 ? "It was" : "They were") + " not added to the profile.",
    );
  });

  discard.addEventListener("click", function () {
    show("Discarded", [], "Nothing was saved to the profile.");
  });

  restart.addEventListener("click", function () {
    items.forEach(function (item) {
      var p = parts(item);
      p.box.checked = true;
      p.select.selectedIndex = 0;
    });
    refresh();
    outcome.hidden = true;
    form.hidden = false;
    parts(items[0]).box.focus();
  });

  // Controls ship disabled so the card is honest without JavaScript.
  items.forEach(function (item) {
    parts(item).box.disabled = false;
  });
  discard.disabled = false;
  refresh();
})();
