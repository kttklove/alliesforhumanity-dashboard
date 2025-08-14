(function(){
function EP(p){ return new URL(p, window.location.href).toString(); }
var ENDPOINTS = {
  shelter_costs: EP("data/endpoints/v1/marion/shelter_costs.json"),
  shelter_contracts: EP("data/endpoints/v1/marion/shelter_contracts.json"),
  hospital_er: EP("data/endpoints/v1/marion/hospital_er_99284.json"),
  ref_costs: EP("data/endpoints/v1/reference/costs.json"),
  findings: EP("data/endpoints/v1/reference/findings.json")
};
function fmtUSD(n){ return (n==null) ? "—" : n.toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0}); }
function qs(sel){ return document.querySelector(sel); }
function loadJSON(path){
  return fetch(path,{cache:"no-store"}).then(function(r){
    if(!r.ok){ throw new Error("Failed to load "+path); }
    return r.json();
  });
}
function provenanceLinks(rows){
  var urls = [];
  for (var i=0;i<(rows||[]).length;i++){
    var r = rows[i]; if(!r) continue;
    var prov = r.provenance;
    if (Object.prototype.toString.call(prov) === "[object Array]"){
      for(var j=0;j<prov.length;j++){ var p = prov[j]; if(p && p.url && urls.indexOf(p.url)===-1){ urls.push(p.url); } }
    } else if (prov && prov.url){ if(urls.indexOf(prov.url)===-1){ urls.push(prov.url); } }
  }
  var s = "";
  for (var k=0;k<urls.length;k++){ s += '<a href="'+urls[k]+'" target="_blank" rel="noopener">source</a>'; if(k<urls.length-1) s += " · "; }
  return s;
}

function init(){
  Promise.all([
    loadJSON(ENDPOINTS.shelter_costs),
    loadJSON(ENDPOINTS.shelter_contracts),
    loadJSON(ENDPOINTS.hospital_er),
    loadJSON(ENDPOINTS.ref_costs),
    loadJSON(ENDPOINTS.findings)
  ]).then(function(all){
    var shelterCosts = all[0], contracts = all[1], ed = all[2], refs = all[3], finds = all[4];

    // Shelter per-diem
    var scRows = (shelterCosts && shelterCosts.data) ? shelterCosts.data : [];
    var scKnown = []; var scPending = [];
    for (var i=0;i<scRows.length;i++){
      var r = scRows[i];
      if (typeof r.value === "number") scKnown.push(r);
      if (r.pending || r.value == null) scPending.push(r);
    }
    var scCtx = qs("#chartShelterCosts");
    if (scKnown.length){
      var labels1 = []; var data1 = [];
      for (var i2=0;i2<scKnown.length;i2++){ labels1.push(scKnown[i2].provider); data1.push(scKnown[i2].value); }
      new Chart(scCtx, { type:"bar", data:{ labels: labels1, datasets:[{ label:"USD per person per night", data:data1 }]},
        options:{ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return fmtUSD(c.parsed.y); } }}},
                  scales:{ y:{ beginAtZero:true, ticks:{ callback:function(v){ return fmtUSD(v); }}} } });
    } else { scCtx.parentNode.replaceChild(document.createTextNode("No published per-diem values yet."), scCtx); }
    if (scPending.length){
      var pend = ""; for (var p=0;p<scPending.length;p++){ pend += 'Pending: <span class="pill">'+scPending[p].provider+'</span> '; }
      qs("#shelterCostsPending").innerHTML = pend;
    }
    qs("#shelterCostsSource").innerHTML = provenanceLinks(scRows);

    // Contracts
    var cRows = (contracts && contracts.data) ? contracts.data : [];
    var cCtx = qs("#chartContracts");
    var labels2 = []; var amounts = [];
    for (var j2=0;j2<cRows.length;j2++){ labels2.push(cRows[j2].program); amounts.push(cRows[j2].amount_usd || 0); }
    new Chart(cCtx, { type:"bar", data:{ labels: labels2, datasets:[{ label:"Amount (USD)", data: amounts }]},
      options:{ indexAxis:"y", plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return fmtUSD(c.parsed.x); }}}},
                scales:{ x:{ ticks:{ callback:function(v){ return fmtUSD(v); }}} } });
    var total = 0; for (var t=0;t<amounts.length;t++){ total += amounts[t]; }
    qs("#contractsStats").innerHTML = '<div class="kpi">'+fmtUSD(total)+'</div><div class="small">Total funding in listed programs</div>';
    qs("#contractsSource").innerHTML = provenanceLinks(cRows);

    // ED by hospital
    var edRows = (ed && ed.data) ? ed.data : [];
    var hospitals = []; // unique labels
    for (var e=0;e<edRows.length;e++){
      var lab = (edRows[e].system||"") + " — " + (edRows[e].facility||"");
      if (hospitals.indexOf(lab) === -1){ hospitals.push(lab); }
    }
    var tabWrap = qs("#edTabs");
    var active = hospitals.length ? hospitals[0] : null;

    function renderED(){
      var el = qs("#chartED");
      var ctx = el.getContext("2d"); ctx.clearRect(0,0,el.width, el.height);
      var rows = []; for (var i3=0;i3<edRows.length;i3++){ var rr = edRows[i3]; if ((rr.system||"")+" — "+(rr.facility||"") === active){ rows.push(rr);} }
      var known = []; for (var k3=0;k3<rows.length;k3++){ if (typeof rows[k3].rate_usd === "number"){ known.push(rows[k3]); } }
      var payers = ["self_pay_cash","medicaid","commercial_example"];
      var lbls = ["self pay cash","medicaid","commercial example"];
      var data = []; for (var p2=0;p2<payers.length;p2++){ var found = null; for (var q=0;q<rows.length;q++){ if (rows[q].payer_type===payers[p2]){ found = rows[q]; break; } } data.push(found ? found.rate_usd : null); }
      if (known.length){
        new Chart(el, { type:"bar", data:{ labels: lbls, datasets:[{ label:"USD per visit", data:data }]},
          options:{ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return fmtUSD(c.parsed.y); }}}},
                    scales:{ y:{ beginAtZero:true, ticks:{ callback:function(v){ return fmtUSD(v); }}}} });
        qs("#edPending").textContent = "";
      } else {
        new Chart(el, { type:"bar", data:{ labels:["No published local rates yet"], datasets:[{ data:[0] }]},
          options:{ plugins:{ legend:{display:false}, tooltip:{enabled:false}}, scales:{ y:{display:false}, x:{display:false}} });
        qs("#edPending").innerHTML = '<span class="pending">Local rate extraction pending</span> · Using national means below.';
      }
      qs("#edSource").innerHTML = provenanceLinks(rows);
    }
    if (hospitals.length){
      for (var h=0; h<hospitals.length; h++){
        (function(hname, first){
          var b = document.createElement("button");
          b.className = "tab" + (first ? " active" : "");
          b.setAttribute("role","tab"); b.setAttribute("aria-selected", first ? "true" : "false");
          b.textContent = hname;
          b.onclick = function(){
            var bs = tabWrap.querySelectorAll("button.tab");
            for (var k=0;k<bs.length;k++){ bs[k].classList.remove("active"); bs[k].setAttribute("aria-selected","false"); }
            b.classList.add("active"); b.setAttribute("aria-selected","true");
            active = hname; renderED();
          };
          tabWrap.appendChild(b);
        })(hospitals[h], h===0);
      }
    } else { tabWrap.innerHTML = '<span class="small">No hospitals found in dataset.</span>'; }
    renderED();

    // Crisis vs Housing comparator
    var refRows = (refs && refs.data) ? refs.data : [];
    function findVal(cat){ for (var i4=0;i4<refRows.length;i4++){ if (refRows[i4].category === cat){ return refRows[i4].value || 0; } } return 0; }
    function findRange(cat){ for (var j4=0;j4<refRows.length;j4++){ if (refRows[j4].category === cat){ return refRows[j4].value_range || null; } } return null; }
    var edMean = findVal("ed_treat_and_release_us") || 750;
    var rrh = findVal("rapid_rehousing_us") || 0;
    var psh = findVal("permanent_supportive_housing_us") || 0;
    var jailRange = findRange("jail_indiana") || [0,0];
    var jailMid = (jailRange[0]+jailRange[1])/2;

    var edVisits = qs("#edVisits");
    var jailNights = qs("#jailNights");
    var cmpCtx = qs("#chartCompare");
    var cmpChart = null;

    function updateCompare(){
      var v = Number(edVisits.value);
      var n = Number(jailNights.value);
      qs("#edVisitsCount").textContent = v;
      qs("#jailNightsCount").textContent = n;

      var edTotal = v * edMean;
      var jailTotalMid = n * jailMid;
      var jailTotalLow = n * jailRange[0];
      var jailTotalHigh = n * jailRange[1];

      qs("#edTotal").textContent = fmtUSD(edTotal);
      qs("#jailTotal").textContent = fmtUSD(jailTotalMid);
      qs("#jailRangeNote").textContent = (jailRange[0] && jailRange[1]) ? " (range "+fmtUSD(jailTotalLow)+"–"+fmtUSD(jailTotalHigh)+")" : "";

      var labels = ["ED total", "Jail total", "Rapid Rehousing (annual)", "PSH (annual)"];
      var data = [edTotal, jailTotalMid, rrh, psh];

      if (cmpChart){ cmpChart.destroy(); }
      cmpChart = new Chart(cmpCtx, {
        type:"bar",
        data:{ labels: labels, datasets:[{ label:"USD", data: data }]},
        options:{ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return fmtUSD(c.parsed.y); }}}},
                  scales:{ y:{ beginAtZero:true, ticks:{ callback:function(v){ return fmtUSD(v); }}}} }
      });
    }
    edVisits.addEventListener("input", updateCompare);
    jailNights.addEventListener("input", updateCompare);
    updateCompare();
    qs("#compareSource").innerHTML = provenanceLinks((function(){
      var arr=[]; for (var i5=0;i5<refRows.length;i5++){ var cat=refRows[i5].category;
        if (cat==="ed_treat_and_release_us" || cat==="rapid_rehousing_us" || cat==="permanent_supportive_housing_us" || cat==="jail_indiana"){ arr.push(refRows[i5]); }
      } return arr; })());

    // Findings
    var fRows = (finds && finds.data) ? finds.data : [];
    var fWrap = qs("#findings");
    for (var f=0; f<fRows.length; f++){
      var row = fRows[f];
      var div = document.createElement("div"); div.className="row"; div.style.margin="6px 0"; div.textContent = "• " + row.text;
      var src = document.createElement("div"); src.className="small"; src.innerHTML = provenanceLinks([row]);
      var box = document.createElement("div"); box.appendChild(div); box.appendChild(src);
      fWrap.appendChild(box);
    }

    // Status
    var status = qs("#status");
    function countPending(rows){ var c=0; for (var i6=0;i6<rows.length;i6++){ if (rows[i6].pending){ c++; } } return c; }
    var cards = [
      { title:"Shelter costs", total: scRows.length, pending: countPending(scRows), src: provenanceLinks(scRows) },
      { title:"Contracts", total: cRows.length, pending: 0, src: provenanceLinks(cRows) },
      { title:"Hospital ED 99284", total: edRows.length, pending: countPending(edRows), src: provenanceLinks(edRows) },
      { title:"Reference costs", total: refRows.length, pending: 0, src: provenanceLinks(refRows) }
    ];
    var html = '<div class="grid">';
    for (var cc=0; cc<cards.length; cc++){
      var c = cards[cc];
      html += '<div class="card span-3" style="padding:12px"><h3>'+c.title+'</h3><div class="row"><div><strong>'+c.total+
              '</strong> rows</div>' + (c.pending ? '<div class="pending">'+c.pending+' pending</div>' : '') +
              '</div><div class="small" style="margin-top:6px">'+c.src+'</div></div>';
    }
    html += '</div>'; status.innerHTML = html;
  }).catch(function(err){
    console.error(err);
    qs("#app").innerHTML = '<div class="card"><h2>Load error</h2><p class="small">'+String(err)+'</p></div>';
  });
}
init();
})();