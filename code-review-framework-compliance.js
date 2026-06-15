/**
 * Framework vs Implementation Compliance Checker — Project Upload Edition
 * Patch for code_review_enterprise release.html
 *
 * Add before </body>:
 *   <script src="code-review-framework-compliance.js"></script>
 *
 * Both framework AND implementation support:
 *   • Upload individual .java / .kt / .groovy files (multi-select)
 *   • Upload full project as .zip / .jar / .war / .ear (auto-extracts all Java sources)
 *   • Drag & drop onto either zone
 *   • OR paste code directly into a textarea
 *
 * Analysis covers 8 compliance categories:
 *   Annotations · Interface/Abstract Coverage · Import & Packages ·
 *   Inheritance · Exception Handling · Logging · Naming Conventions ·
 *   Structural Patterns
 */

(function () {
    'use strict';

    /* =========================================================
       SECTION A — FILE STORE
       Separate stores for framework files and impl files
       ========================================================= */

    const store = {
        fw:   [],   // { filename, code }
        impl: []    // { filename, code }
    };

    function addFiles(side, newFiles) {
        newFiles.forEach(f => {
            if (!store[side].find(x => x.filename === f.filename)) store[side].push(f);
        });
        renderFileList(side);
    }

    function removeFile(side, idx) {
        store[side].splice(idx, 1);
        renderFileList(side);
    }

    function clearSide(side) {
        store[side] = [];
        renderFileList(side);
    }

    function mergeCode(side) {
        return store[side].map(f => `\n// === FILE: ${f.filename} ===\n${f.code}`).join('\n');
    }

    /* ─── Extract Java sources from ZIP/JAR/WAR/EAR ─── */
    async function extractArchive(file, side) {
        setStatus(`Extracting ${file.name}…`);
        const JSZip = window.JSZip;
        if (!JSZip) { setStatus('JSZip not found — ensure jszip.min.js is included.'); return; }
        try {
            const zip = await JSZip.loadAsync(file);
            const tasks = [];
            zip.forEach((path, entry) => {
                if (!entry.dir && /\.(java|kt|groovy)$/i.test(path)) {
                    tasks.push(entry.async('string').then(code => ({ filename: path, code })));
                }
            });
            const files = await Promise.all(tasks);
            addFiles(side, files);
            setStatus(`Extracted ${files.length} source file(s) from ${file.name}`);
        } catch (e) {
            setStatus('Archive extraction failed: ' + e.message);
        }
    }

    /* ─── Read plain source files ─── */
    function readSourceFiles(fileList, side) {
        Array.from(fileList).forEach(f => {
            const r = new FileReader();
            r.onload = e => addFiles(side, [{ filename: f.name, code: e.target.result }]);
            r.readAsText(f);
        });
    }

    /* ─── Render file list for a side ─── */
    function renderFileList(side) {
        const el = document.getElementById(`fc2-list-${side}`);
        if (!el) return;
        const files = store[side];
        if (files.length === 0) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.innerHTML = files.map((f, i) => `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.75rem;
                        border-bottom:1px solid var(--border);font-size:0.78rem">
                <span style="color:var(--accent-blue)">☕</span>
                <span style="flex:1;font-family:'Fira Code',monospace;white-space:nowrap;
                             overflow:hidden;text-overflow:ellipsis" title="${f.filename}">${f.filename}</span>
                <span style="color:var(--text-muted);flex-shrink:0">${f.code.split('\n').length}L</span>
                <button onclick="window._fc2Remove('${side}',${i})"
                    style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.9rem;flex-shrink:0">✕</button>
            </div>`).join('');
        const countEl = document.getElementById(`fc2-count-${side}`);
        if (countEl) countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    }

    /* =========================================================
       SECTION B — COMPLIANCE ANALYSIS ENGINE
       (same 8-category logic, now operates on merged corpus)
       ========================================================= */

    function extractAnnotations(code) {
        const s = new Set();
        const re = /@(\w+)(?:\s*\(|[\s\n])/gm;
        let m;
        while ((m = re.exec(code))) s.add(m[1]);
        return [...s];
    }

    function extractInterfaces(code) {
        const r = [], re = /\binterface\s+(\w+)/gm; let m;
        while ((m = re.exec(code))) r.push(m[1]);
        return r;
    }

    function extractAbstractMethods(code) {
        const r = [], re = /\babstract\s+(?:[\w<>\[\]]+\s+)+(\w+)\s*\(([^)]*)\)/gm; let m;
        while ((m = re.exec(code))) r.push({ name: m[1], params: m[2].trim() });
        return r;
    }

    function extractInterfaceMethods(code) {
        const r = [], re = /(?:^|\n)\s*(?:(?:public|default|static)\s+)?(?!class|interface|enum)[\w<>\[\],\s]+\s+(\w+)\s*\(([^)]*)\)\s*(?:throws[\w,\s]+)?\s*;/gm; let m;
        while ((m = re.exec(code))) r.push({ name: m[1], params: m[2].trim() });
        return r;
    }

    function extractMethodNames(code) {
        const r = new Set(), re = /(?:public|protected|private)\s+(?:static\s+|final\s+)*(?:[\w<>\[\],\s]+)\s+(\w+)\s*\(/gm; let m;
        while ((m = re.exec(code))) if (!['class','interface','enum','if','for','while','switch'].includes(m[1])) r.add(m[1]);
        return r;
    }

    function extractImports(code) {
        const r = [], re = /^import\s+([\w.*]+)\s*;/gm; let m;
        while ((m = re.exec(code))) r.push(m[1]);
        return r;
    }

    function extractExtendsImplements(code) {
        const res = { extends: [], implements: [] };
        let m;
        const er = /\bextends\s+([\w,\s<>]+?)(?:\s+implements|\s*\{)/gm;
        const ir = /\bimplements\s+([\w,\s<>]+?)(?:\s*\{)/gm;
        while ((m = er.exec(code))) res.extends.push(...m[1].split(',').map(s => s.trim().replace(/<.*>/, '')));
        while ((m = ir.exec(code))) res.implements.push(...m[1].split(',').map(s => s.trim().replace(/<.*>/, '')));
        return res;
    }

    function extractEH(code) {
        return {
            hasTryCatch:     /\btry\s*\{/.test(code),
            usesCustomEx:    /throw\s+new\s+\w+Exception/.test(code),
            logsExceptions:  /log\w*\.(error|warn)\s*\(|logger\.(error|warn)\s*\(/.test(code),
            swallows:        /catch\s*\([^)]+\)\s*\{\s*(?:\/\/[^\n]*)?\s*\}/m.test(code)
        };
    }

    function extractLogging(code) {
        return {
            hasLogger:  /\bLogger\b|\blog\b\s*=|\bLOGGER\b/.test(code),
            usesSlf4j:  /org\.slf4j|LoggerFactory\.getLogger/.test(code),
            usesLombok: /@Slf4j|@Log4j2|@CommonsLog/.test(code)
        };
    }

    function extractNaming(code) {
        const classes = (code.match(/\bclass\s+(\w+)/gm) || []).map(s => s.replace('class ', ''));
        return {
            hasPascalCase:  classes.every(c => /^[A-Z]/.test(c)),
            hasImplSuffix:  classes.some(c => /Impl$/.test(c)),
            hasDtoSuffix:   classes.some(c => /Dto$|DTO$/.test(c)),
            hasRepoSuffix:  classes.some(c => /Repository$/.test(c))
        };
    }

    /* ─── Main compliance analysis ─── */
    function analyzeCompliance(fwCode, implCode, fwLabel, implLabel) {
        const report = { categories: [], compliant: [], violations: [], overall: 0, maxScore: 0 };

        function category(name, icon, checks) {
            let cScore = 0, cMax = 0;
            const items = [];
            checks.forEach(({ label, passed, weight, ok, bad, fix }) => {
                cMax += weight;
                if (passed) { cScore += weight; if (ok) report.compliant.push(ok); }
                else { if (bad) report.violations.push({ label, bad, fix }); }
                items.push({ label, passed, weight });
            });
            report.overall  += cScore;
            report.maxScore += cMax;
            const pct = cMax > 0 ? Math.round(cScore / cMax * 100) : 100;
            report.categories.push({ name, icon, score: cScore, maxScore: cMax, pct, items });
        }

        const fwAnn   = extractAnnotations(fwCode);
        const implAnn = extractAnnotations(implCode);
        const fwIfaces = extractInterfaces(fwCode);
        const fwAbsMethods = extractAbstractMethods(fwCode);
        const fwIfMethods  = extractInterfaceMethods(fwCode);
        const implMethodNames = extractMethodNames(implCode);
        const fwImports   = extractImports(fwCode);
        const implImports  = extractImports(implCode);
        const fwHier  = extractExtendsImplements(fwCode);
        const implHier = extractExtendsImplements(implCode);
        const fwEH    = extractEH(fwCode);
        const implEH   = extractEH(implCode);
        const fwLog   = extractLogging(fwCode);
        const implLog  = extractLogging(implCode);
        const fwNam   = extractNaming(fwCode);
        const implNam  = extractNaming(implCode);

        const critAnns = ['RestController','Controller','Service','Repository','Component',
            'Transactional','Autowired','Valid','NotNull','NotBlank','Slf4j','Log4j2',
            'Aspect','Entity','RequestMapping','GetMapping','PostMapping','PutMapping','DeleteMapping'];
        const fwCrit = fwAnn.filter(a => critAnns.includes(a));

        /* 1 — Annotation compliance */
        category('Annotation Compliance', '🏷️',
            fwCrit.length === 0
                ? [{ label: 'No critical annotations in framework', passed: true, weight: 1, ok: 'No annotation requirements' }]
                : fwCrit.map(ann => ({
                    label: `@${ann} present`,
                    passed: implAnn.includes(ann),
                    weight: ['Service','Repository','RestController','Controller','Transactional','Valid'].includes(ann) ? 4 : 2,
                    ok:  `@${ann} correctly applied`,
                    bad: `@${ann} in framework but missing in implementation`,
                    fix: `Add @${ann} to the appropriate class or method`
                }))
        );

        /* 2 — Interface / abstract method coverage */
        const required = [...fwAbsMethods, ...fwIfMethods];
        category('Interface & Abstract Coverage', '🔌',
            fwIfaces.length === 0 && required.length === 0
                ? [{ label: 'No interface contracts defined', passed: true, weight: 1, ok: 'No contracts to implement' }]
                : [
                    ...fwIfaces.map(iface => ({
                        label: `Implements ${iface}`,
                        passed: implHier.implements.includes(iface) || implCode.includes(`implements ${iface}`) || implCode.includes(`extends ${iface}`),
                        weight: 4,
                        ok:  `${iface} interface correctly implemented`,
                        bad: `Interface ${iface} defined in framework but not implemented`,
                        fix: `public class YourClass implements ${iface} { /* implement all methods */ }`
                    })),
                    ...required.map(m => ({
                        label: `Method ${m.name}() overridden`,
                        passed: implMethodNames.has(m.name),
                        weight: 3,
                        ok:  `${m.name}() correctly implemented`,
                        bad: `Required method ${m.name}() not found in implementation`,
                        fix: `@Override public <ReturnType> ${m.name}(${m.params}) { /* impl */ }`
                    }))
                ]
        );

        /* 3 — Import & package compliance */
        const fwPkgs = [...new Set(fwImports.map(i => i.split('.').slice(0,-1).join('.')).filter(p =>
            p.startsWith('org.spring') || p.startsWith('javax.') || p.startsWith('jakarta.') || p.startsWith('org.slf4j') || p.startsWith('io.github.resilience')))];
        category('Import & Package Compliance', '📦',
            fwPkgs.length === 0
                ? [{ label: 'No framework packages required', passed: true, weight: 1, ok: 'No specific package imports required' }]
                : fwPkgs.map(pkg => ({
                    label: `Uses ${pkg}`,
                    passed: implImports.some(i => i.startsWith(pkg)),
                    weight: 2,
                    ok:  `${pkg} correctly imported`,
                    bad: `Framework uses ${pkg} but implementation doesn't import it`,
                    fix: `import ${pkg}.*;  // or specific classes`
                }))
        );

        /* 4 — Inheritance compliance */
        const parents = fwHier.extends.filter(c => c && c !== 'Object');
        category('Inheritance & Extension', '🧬',
            parents.length === 0
                ? [{ label: 'No mandatory inheritance', passed: true, weight: 1, ok: 'No specific base class required' }]
                : parents.map(p => ({
                    label: `Extends ${p}`,
                    passed: implHier.extends.includes(p) || implCode.includes(`extends ${p}`),
                    weight: 4,
                    ok:  `Correctly extends ${p}`,
                    bad: `Framework requires extending ${p} but implementation does not`,
                    fix: `public class YourClass extends ${p} { ... }`
                }))
        );

        /* 5 — Exception handling */
        const ehChecks = [];
        if (fwEH.hasTryCatch)   ehChecks.push({ label:'Uses try-catch',         passed:implEH.hasTryCatch,  weight:3, ok:'Exception handling matches',  bad:'Framework uses try-catch but implementation has none',                   fix:'Wrap risky calls in try-catch matching framework pattern' });
        if (fwEH.usesCustomEx)  ehChecks.push({ label:'Custom exception types',  passed:implEH.usesCustomEx, weight:3, ok:'Custom exceptions used',       bad:'Framework throws custom exceptions but impl uses generic RuntimeException', fix:'throw new YourCustomException("msg", cause);' });
        if (fwEH.logsExceptions) ehChecks.push({ label:'Exceptions logged (not swallowed)', passed:implEH.logsExceptions && !implEH.swallows, weight:3, ok:'Exceptions properly logged', bad: implEH.swallows ? 'Exceptions silently swallowed' : 'Framework logs exceptions but impl does not', fix:'log.error("Operation failed: {}", e.getMessage(), e);' });
        if (ehChecks.length === 0) ehChecks.push({ label:'No exception handling required', passed:true, weight:1, ok:'No specific error handling pattern mandated' });
        category('Exception Handling Compliance', '⚠️', ehChecks);

        /* 6 — Logging */
        const logChecks = [];
        if (fwLog.hasLogger) {
            logChecks.push({ label:'Logger declared', passed:implLog.hasLogger, weight:2, ok:'Logger declared correctly', bad:'Framework uses a logger but implementation does not', fix: fwLog.usesLombok ? '@Slf4j on the class' : 'private static final Logger log = LoggerFactory.getLogger(getClass());' });
            if (fwLog.usesSlf4j)  logChecks.push({ label:'Uses SLF4J',     passed:implLog.usesSlf4j || implLog.usesLombok,  weight:2, ok:'SLF4J logging consistent', bad:'Framework uses SLF4J; impl uses different logger', fix:'import org.slf4j.Logger; import org.slf4j.LoggerFactory;' });
            if (fwLog.usesLombok) logChecks.push({ label:'Uses @Slf4j/@Log4j2', passed:implLog.usesLombok, weight:2, ok:'Lombok logging annotation used', bad:'Framework uses Lombok @Slf4j; impl manually declares logger', fix:'@Slf4j\npublic class YourClass { ... }' });
        } else logChecks.push({ label:'No logging standard defined', passed:true, weight:1, ok:'No logging standard mandated' });
        category('Logging Compliance', '📋', logChecks);

        /* 7 — Naming conventions */
        const namChecks = [];
        if (fwNam.hasImplSuffix) namChecks.push({ label:'"Impl" suffix on implementations', passed:implNam.hasImplSuffix, weight:2, ok:'Impl suffix convention followed', bad:'Framework uses Impl suffix but implementation does not', fix:'class UserServiceImpl implements UserService { ... }' });
        if (fwNam.hasDtoSuffix)  namChecks.push({ label:'"Dto"/"DTO" suffix on data classes', passed:implNam.hasDtoSuffix, weight:2, ok:'DTO suffix convention followed', bad:'Framework uses Dto suffix but implementation does not', fix:'class UserDto { ... }' });
        if (fwNam.hasRepoSuffix) namChecks.push({ label:'"Repository" suffix', passed:implNam.hasRepoSuffix, weight:2, ok:'Repository suffix convention followed', bad:'Framework uses Repository suffix but implementation does not', fix:'interface UserRepository extends JpaRepository<User,Long> {}' });
        namChecks.push({ label:'PascalCase class names', passed:implNam.hasPascalCase, weight:2, ok:'PascalCase naming correct', bad:'Class names do not follow PascalCase', fix:'Rename: class UserService (not userService)' });
        category('Naming Convention Compliance', '🏷️', namChecks);

        /* 8 — Structural patterns */
        const strChecks = [];
        const fwCtorInj  = /private\s+final\s+\w+\s+\w+/m.test(fwCode) || /@RequiredArgsConstructor/.test(fwCode);
        const fwFieldInj = /@Autowired\b/.test(fwCode);
        if (fwCtorInj)  strChecks.push({ label:'Constructor injection (final fields)', passed:/private\s+final\s+\w+\s+\w+/m.test(implCode) || /@RequiredArgsConstructor/.test(implCode), weight:4, ok:'Constructor injection follows framework',  bad:'Framework uses constructor injection; impl uses @Autowired fields', fix:'@RequiredArgsConstructor or explicit constructor with final fields' });
        if (fwFieldInj && !fwCtorInj) strChecks.push({ label:'Field injection consistent', passed:/@Autowired\b/.test(implCode), weight:2, ok:'Field injection style consistent', bad:'Framework uses @Autowired; impl does not inject dependencies', fix:'@Autowired private UserService service;' });
        if (/ResponseEntity/.test(fwCode)) strChecks.push({ label:'Returns ResponseEntity', passed:/ResponseEntity/.test(implCode), weight:3, ok:'ResponseEntity pattern consistent', bad:'Framework returns ResponseEntity; impl returns raw objects', fix:'return ResponseEntity.ok(dto);' });
        if (/Optional</.test(fwCode)) strChecks.push({ label:'Uses Optional<> for nullable returns', passed:/Optional</.test(implCode), weight:2, ok:'Optional<> pattern consistent', bad:'Framework uses Optional<>; impl can return null', fix:'public Optional<User> findById(Long id) { return repo.findById(id); }' });
        if (strChecks.length === 0) strChecks.push({ label:'No structural pattern requirements', passed:true, weight:1, ok:'No specific structural patterns mandated' });
        category('Structural Pattern Compliance', '🏗️', strChecks);

        const pct = report.maxScore > 0 ? Math.round(report.overall / report.maxScore * 100) : 0;
        report.percentage = pct;
        report.grade      = pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
        report.gradeColor = pct >= 85 ? '#3fb950' : pct >= 70 ? '#d29922' : pct >= 55 ? '#f0883e' : '#f85149';
        report.fwFiles    = store.fw.length;
        report.implFiles  = store.impl.length;
        report.fwLabel    = fwLabel;
        report.implLabel  = implLabel;
        return report;
    }

    /* =========================================================
       SECTION C — RENDER REPORT
       ========================================================= */

    function renderReport(report) {
        const el = document.getElementById('fc2-results');
        if (!el) return;

        const { percentage: pct, grade, gradeColor: gc } = report;

        const categoryRows = report.categories.map(cat => {
            const col = cat.pct >= 80 ? '#3fb950' : cat.pct >= 65 ? '#d29922' : cat.pct >= 45 ? '#f0883e' : '#f85149';
            const chips = cat.items.map(it => `
                <span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.18rem 0.5rem;
                    border-radius:10px;font-size:0.68rem;margin:0.15rem;
                    background:${it.passed ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)'};
                    color:${it.passed ? '#3fb950' : '#f85149'};
                    border:1px solid ${it.passed ? '#3fb95044' : '#f8514944'}">
                    ${it.passed ? '✓' : '✗'} ${it.label}</span>`).join('');
            return `
                <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:0.75rem">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.55rem">
                        <span style="font-size:1.1rem">${cat.icon}</span>
                        <span style="font-weight:600;font-size:0.88rem;flex:1">${cat.name}</span>
                        <span style="font-size:0.7rem;color:var(--text-muted)">${cat.score}/${cat.maxScore}pt</span>
                        <span style="font-weight:800;color:${col};min-width:40px;text-align:right">${cat.pct}%</span>
                    </div>
                    <div style="height:5px;background:var(--bg-primary);border-radius:3px;overflow:hidden;margin-bottom:0.65rem">
                        <div style="height:100%;width:${cat.pct}%;background:${col};border-radius:3px;transition:width 0.5s ease"></div>
                    </div>
                    <div>${chips}</div>
                </div>`;
        }).join('');

        const violHTML = report.violations.map(v => `
            <div style="background:#1a0808;border:1px solid rgba(248,81,73,0.3);border-radius:8px;padding:0.875rem;margin-bottom:0.6rem">
                <div style="font-size:0.78rem;font-weight:600;color:#f85149;margin-bottom:0.3rem">${v.label}</div>
                <div style="font-size:0.79rem;color:var(--text-secondary);margin-bottom:0.4rem">${v.bad}</div>
                <div style="font-size:0.73rem;color:#3fb950;font-family:'Fira Code',monospace;
                            border-left:2px solid #3fb950;padding-left:0.5rem;white-space:pre-wrap">💡 ${v.fix}</div>
            </div>`).join('');

        const okHTML = report.compliant.map(c => `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;
                        border-bottom:1px solid rgba(48,54,61,0.4);font-size:0.78rem;color:var(--text-secondary)">
                <span style="color:#3fb950;flex-shrink:0">✓</span>${c}
            </div>`).join('');

        el.innerHTML = `
            <!-- Hero -->
            <div style="display:grid;grid-template-columns:auto 1fr;gap:1.5rem;align-items:center;
                        background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem">
                <div style="text-align:center">
                    <div style="font-size:3.5rem;font-weight:900;color:${gc};line-height:1">${grade}</div>
                    <div style="font-size:1.1rem;font-weight:700;color:${gc}">${pct}%</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">COMPLIANCE</div>
                </div>
                <div>
                    <div style="height:10px;background:var(--bg-primary);border-radius:5px;overflow:hidden;margin-bottom:1rem">
                        <div style="height:100%;width:${pct}%;background:${gc};border-radius:5px;transition:width 0.6s ease"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;margin-bottom:0.75rem">
                        ${[
                            [`${report.fwFiles}`, 'FW Files', '#bc8cff'],
                            [`${report.implFiles}`, 'Impl Files', '#58a6ff'],
                            [`${report.compliant.length}`, 'Compliant', '#3fb950'],
                            [`${report.violations.length}`, 'Violations', report.violations.length > 0 ? '#f85149' : '#3fb950'],
                        ].map(([v,l,c]) => `
                            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;padding:0.6rem;text-align:center">
                                <div style="font-size:1.4rem;font-weight:700;color:${c}">${v}</div>
                                <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase">${l}</div>
                            </div>`).join('')}
                    </div>
                    <div style="font-size:0.77rem;color:var(--text-muted)">
                        <span style="color:var(--accent-purple)">📐 ${report.fwLabel}</span>
                        <span style="margin:0 0.4rem">vs</span>
                        <span style="color:var(--accent-blue)">🔧 ${report.implLabel}</span>
                    </div>
                </div>
            </div>

            <!-- Categories -->
            <div style="font-size:1rem;font-weight:600;margin-bottom:0.75rem">📊 Compliance Categories</div>
            ${categoryRows}

            <!-- Violations -->
            ${report.violations.length ? `
                <div style="font-size:1rem;font-weight:600;color:#f85149;margin:1.25rem 0 0.75rem">
                    ❌ Violations (${report.violations.length})</div>
                ${violHTML}` : `<div style="color:#3fb950;font-weight:600;margin:1rem 0">✅ No violations — all checks passing!</div>`}

            <!-- Compliant -->
            ${report.compliant.length ? `
                <div style="font-size:1rem;font-weight:600;color:#3fb950;margin:1.25rem 0 0.75rem">
                    ✅ Compliant (${report.compliant.length})</div>
                <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:0.875rem 1rem">
                    ${okHTML}</div>` : ''}

            <!-- Export -->
            <div style="margin-top:1.25rem;text-align:right">
                <button class="btn btn-sm" onclick="window._fc2Export()">📄 Export Report</button>
            </div>`;
    }

    /* =========================================================
       SECTION D — INJECT UI
       ========================================================= */

    function buildUploadZone(side, label, color, icon) {
        const sideId = side;
        return `
        <div>
            <!-- Header -->
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">
                <span style="font-size:1rem">${icon}</span>
                <span style="font-size:0.85rem;font-weight:700;color:${color}">${label}</span>
                <span id="fc2-count-${sideId}" style="font-size:0.72rem;color:var(--text-muted);margin-left:auto"></span>
            </div>

            <!-- Upload buttons -->
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.6rem">
                <label class="btn btn-sm" style="cursor:pointer;font-size:0.78rem">
                    ☕ .java / .kt files
                    <input type="file" accept=".java,.kt,.groovy" multiple style="display:none"
                        onchange="window._fc2Files('${sideId}',this.files);this.value=''">
                </label>
                <label class="btn btn-sm" style="cursor:pointer;font-size:0.78rem">
                    📦 ZIP / JAR / WAR
                    <input type="file" accept=".zip,.jar,.war,.ear" style="display:none"
                        onchange="window._fc2Archive('${sideId}',this.files[0]);this.value=''">
                </label>
                <button class="btn btn-sm" onclick="window._fc2Clear('${sideId}')"
                    style="font-size:0.78rem">🗑 Clear</button>
            </div>

            <!-- Drop zone -->
            <div id="fc2-drop-${sideId}" style="border:2px dashed var(--border);border-radius:8px;
                    padding:1.5rem;text-align:center;cursor:pointer;transition:all 0.25s;min-height:100px"
                ondragover="event.preventDefault();this.style.borderColor='${color}';this.style.background='${color}11'"
                ondragleave="this.style.borderColor='';this.style.background=''"
                ondrop="event.preventDefault();this.style.borderColor='';this.style.background='';window._fc2Drop('${sideId}',event)">
                <div style="font-size:2rem;opacity:0.35;margin-bottom:0.4rem">📂</div>
                <div style="font-size:0.78rem;color:var(--text-muted)">Drop files or archive here<br>
                    <span style="font-size:0.68rem">.java · .kt · .zip · .jar · .war · .ear</span></div>
            </div>

            <!-- Paste toggle -->
            <details style="margin-top:0.5rem">
                <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-muted);padding:0.3rem 0">
                    or paste code directly ▸</summary>
                <div style="margin-top:0.4rem">
                    <input id="fc2-paste-name-${sideId}" class="paste-input"
                        placeholder="filename.java" style="width:100%;margin-bottom:0.4rem;font-size:0.8rem">
                    <textarea id="fc2-paste-${sideId}" class="code-textarea" rows="8"
                        placeholder="Paste ${label.toLowerCase()} code here…"></textarea>
                    <button class="btn btn-sm" style="margin-top:0.4rem;font-size:0.78rem"
                        onclick="window._fc2AddPaste('${sideId}')">+ Add to ${label}</button>
                </div>
            </details>

            <!-- File list -->
            <div id="fc2-list-${sideId}" style="display:none;margin-top:0.6rem;max-height:180px;
                overflow-y:auto;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px"></div>
        </div>`;
    }

    function injectUI() {
        const tabBar = document.querySelector('.upload-tabs');
        if (!tabBar || tabBar.querySelector('[data-fc2-tab]')) return;

        const btn = document.createElement('button');
        btn.className = 'upload-tab';
        btn.dataset.fc2Tab = '1';
        btn.innerHTML = '🆚 FW vs Impl';
        btn.addEventListener('click', activateTab);
        tabBar.appendChild(btn);

        const content = document.querySelector('.upload-content');
        if (!content) return;

        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.id = 'fc2-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div style="margin-bottom:1rem">
                <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1.25rem;
                            background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:0.875rem">
                    Upload your <strong style="color:#bc8cff">framework / standard project</strong> on the left
                    and your <strong style="color:#58a6ff">implementation project</strong> on the right.
                    Both sides support <strong>.java/.kt files</strong> and full project archives
                    (<strong>.zip · .jar · .war · .ear</strong>).
                    The tool extracts all source files and scores how well the implementation follows the framework.
                </div>

                <!-- Two upload zones side by side -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem">
                    ${buildUploadZone('fw',   '📐 Framework / Standard', '#bc8cff', '📐')}
                    ${buildUploadZone('impl', '🔧 Implementation',       '#58a6ff', '🔧')}
                </div>

                <!-- Name labels + actions -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1rem">
                    <input id="fc2-fw-label"   class="paste-input" placeholder="Framework label e.g. company-standards-v2.zip"   style="font-size:0.82rem">
                    <input id="fc2-impl-label" class="paste-input" placeholder="Implementation label e.g. user-service-1.0.war" style="font-size:0.82rem">
                </div>

                <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
                    <button class="btn btn-primary" onclick="window._fc2Analyse()">⚖️ Analyse Compliance</button>
                    <button class="btn btn-sm" onclick="window._fc2Sample()">🧪 Load Sample Projects</button>
                    <span id="fc2-status" style="font-size:0.8rem;color:var(--text-muted)"></span>
                </div>
            </div>`;
        content.appendChild(panel);

        /* Results section injected after upload section */
        const resultSec = document.createElement('div');
        resultSec.id = 'fc2-results-section';
        resultSec.style.display = 'none';
        resultSec.style.marginTop = '2rem';
        resultSec.innerHTML = `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;overflow:hidden">
                <div style="background:var(--bg-tertiary);padding:1rem 1.5rem;border-bottom:1px solid var(--border);
                            font-weight:700;font-size:1rem;background:linear-gradient(135deg,#bc8cff,#58a6ff);
                            -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
                    ⚖️ Framework vs Implementation — Compliance Report
                </div>
                <div id="fc2-results" style="padding:1.5rem;max-height:80vh;overflow-y:auto"></div>
            </div>`;
        const uploadSec = document.querySelector('.upload-section');
        if (uploadSec) uploadSec.insertAdjacentElement('afterend', resultSec);
        else document.querySelector('.container').appendChild(resultSec);
    }

    function activateTab() {
        document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
        const b = document.querySelector('[data-fc2-tab]');
        const p = document.getElementById('fc2-panel');
        if (b) b.classList.add('active');
        if (p) { p.classList.add('active'); p.style.display = 'block'; }
    }

    /* =========================================================
       SECTION E — GLOBAL HANDLERS
       ========================================================= */

    window._fc2Files   = (side, files) => readSourceFiles(files, side);
    window._fc2Archive = (side, file)  => { if (file) extractArchive(file, side); };
    window._fc2Clear   = (side)        => clearSide(side);
    window._fc2Remove  = (side, idx)   => removeFile(side, idx);

    window._fc2Drop = function (side, e) {
        Array.from(e.dataTransfer.files).forEach(f => {
            if (/\.(zip|jar|war|ear)$/i.test(f.name)) extractArchive(f, side);
            else if (/\.(java|kt|groovy)$/i.test(f.name)) readSourceFiles([f], side);
        });
    };

    window._fc2AddPaste = function (side) {
        const code = (document.getElementById(`fc2-paste-${side}`) || {}).value || '';
        const name = (document.getElementById(`fc2-paste-name-${side}`) || {}).value || `pasted-${Date.now()}.java`;
        if (!code.trim()) return;
        addFiles(side, [{ filename: name, code }]);
        const ta = document.getElementById(`fc2-paste-${side}`);
        if (ta) ta.value = '';
    };

    window._fc2Analyse = function () {
        if (store.fw.length === 0)   { setStatus('⚠️ Upload or paste framework code first.'); return; }
        if (store.impl.length === 0) { setStatus('⚠️ Upload or paste implementation code first.'); return; }
        setStatus(`Analysing ${store.fw.length} framework file(s) vs ${store.impl.length} implementation file(s)…`);

        setTimeout(() => {
            const fwCode   = mergeCode('fw');
            const implCode = mergeCode('impl');
            const fwLabel   = (document.getElementById('fc2-fw-label')   || {}).value || `${store.fw.length} framework file(s)`;
            const implLabel = (document.getElementById('fc2-impl-label') || {}).value || `${store.impl.length} implementation file(s)`;
            const report = analyzeCompliance(fwCode, implCode, fwLabel, implLabel);
            window._fc2LastReport = report;
            renderReport(report);
            const sec = document.getElementById('fc2-results-section');
            if (sec) { sec.style.display = ''; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            setStatus(`Done — ${report.percentage}% compliant · ${report.violations.length} violation(s) found`);
        }, 60);
    };

    /* ─── Sample projects ─── */
    window._fc2Sample = function () {
        clearSide('fw');
        clearSide('impl');

        addFiles('fw', [
            { filename: 'BaseService.java', code: `import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

/** FRAMEWORK STANDARD: All services MUST extend this class */
public abstract class BaseService<T, ID> {
    protected final Logger log = LoggerFactory.getLogger(getClass());

    @Transactional
    public abstract T create(T entity);

    @Transactional
    public abstract T update(ID id, T entity);

    @Transactional
    public abstract void delete(ID id);

    public abstract Optional<T> findById(ID id);

    protected void requireNonNull(Object val, String name) {
        if (val == null) throw new ValidationException(name + " must not be null");
    }
}` },
            { filename: 'BaseController.java', code: `import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import javax.validation.Valid;

/** FRAMEWORK STANDARD: All controllers MUST extend this class */
public abstract class BaseController<T, ID> {
    @PostMapping
    public abstract ResponseEntity<T> create(@Valid @RequestBody T dto);

    @GetMapping("/{id}")
    public abstract ResponseEntity<T> get(@PathVariable ID id);

    @DeleteMapping("/{id}")
    public abstract ResponseEntity<Void> delete(@PathVariable ID id);
}` },
            { filename: 'company-standards.java', code: `// COMPANY CODING STANDARDS
// 1. All services must use constructor injection (no @Autowired fields)
// 2. All controllers return ResponseEntity<Dto> — never return @Entity
// 3. All repositories must be interfaces extending JpaRepository
// 4. Always log with SLF4J (@Slf4j from Lombok preferred)
// 5. Custom exceptions: never throw plain RuntimeException
// 6. Use Optional<T> for nullable returns from service methods
// Required imports:
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.ResponseEntity;
import java.util.Optional;` }
        ]);

        addFiles('impl', [
            { filename: 'UserService.java', code: `// BAD IMPLEMENTATION — violates framework standards
import org.springframework.beans.factory.annotation.Autowired;
import javax.persistence.EntityManager;

// Missing @Service annotation
// Missing extends BaseService
public class UserService {
    @Autowired  // VIOLATION: field injection instead of constructor
    private UserRepository userRepository;

    @Autowired
    private EntityManager em;  // VIOLATION: direct EM in service

    // VIOLATION: no @Transactional, returns null instead of Optional
    public User create(User user) {
        try {
            return userRepository.save(user);
        } catch (Exception e) {
            // VIOLATION: swallowing exception silently
        }
        return null;
    }

    // VIOLATION: no @Transactional on write method
    public User update(Long id, User updated) {
        User u = userRepository.findById(id).orElse(null);
        if (u == null) throw new RuntimeException("Not found"); // VIOLATION: plain RuntimeException
        u.setName(updated.getName());
        return userRepository.save(u);
    }
}` },
            { filename: 'UserController.java', code: `// BAD IMPLEMENTATION — violates framework standards
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

// Missing extends BaseController
@RestController @RequestMapping("/users")
public class UserController {

    @Autowired  // VIOLATION: field injection
    private UserRepository userRepository;  // VIOLATION: repo in controller

    // VIOLATION: no @Valid, returns @Entity not Dto, business logic in controller
    @PostMapping
    public User createUser(@RequestBody User user) {
        if (user.getName() == null) throw new RuntimeException("bad");
        return userRepository.save(user);  // returns @Entity
    }

    // VIOLATION: business logic in controller
    @GetMapping("/active")
    public List<User> getActive() {
        return userRepository.findAll().stream()
            .filter(User::isActive)
            .collect(java.util.stream.Collectors.toList());
    }
}` },
            { filename: 'UserRepository.java', code: `// BAD REPOSITORY — violates framework standards
import org.springframework.stereotype.Repository;
import javax.persistence.EntityManager;
import org.springframework.transaction.annotation.Transactional;

// VIOLATION: class not interface, business logic in repo
@Repository
public class UserRepository {
    private EntityManager em;

    public User findAndValidate(Long id) {
        User u = em.find(User.class, id);
        if (u == null) throw new RuntimeException("not found"); // business logic!
        if (!u.isActive()) throw new RuntimeException("inactive");
        return u;
    }

    @Transactional  // VIOLATION: transaction in repo
    public void batchUpdate(java.util.List<Long> ids) {
        ids.forEach(id -> em.find(User.class, id));
    }
}` }
        ]);

        document.getElementById('fc2-fw-label').value   = 'company-framework-standards';
        document.getElementById('fc2-impl-label').value = 'user-service-impl (bad)';
        setStatus('Sample projects loaded (3 framework files vs 3 bad implementation files). Click Analyse.');
    };

    window._fc2Export = function () {
        const el = document.getElementById('fc2-results');
        if (!el || !el.innerHTML.trim()) { setStatus('Nothing to export yet.'); return; }
        const r = window._fc2LastReport || {};
        const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>Framework Compliance Report</title>
            <style>body{font-family:Arial,sans-serif;background:#0d1117;color:#c9d1d9;padding:2rem;max-width:1100px;margin:0 auto}
            h1{color:#bc8cff}</style></head><body>
            <h1>⚖️ Framework vs Implementation Compliance Report</h1>
            <p>Framework: ${r.fwLabel || ''} (${r.fwFiles || 0} files) &nbsp;|&nbsp;
               Implementation: ${r.implLabel || ''} (${r.implFiles || 0} files)</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
            ${el.innerHTML}</body></html>`
        ], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fw-compliance-${Date.now()}.html`;
        a.click();
    };

    function setStatus(msg) {
        const el = document.getElementById('fc2-status');
        if (el) el.textContent = msg;
    }

    /* =========================================================
       SECTION F — RESPONSIVE CSS + INIT
       ========================================================= */

    function injectCSS() {
        const s = document.createElement('style');
        s.textContent = `
            #fc2-panel { display: none; }
            #fc2-panel.active { display: block; }
            #fc2-results-section { display: none; }
            @media (max-width: 800px) {
                #fc2-panel [style*="grid-template-columns:1fr 1fr"] {
                    grid-template-columns: 1fr !important;
                }
            }`;
        document.head.appendChild(s);
    }

    function init() {
        injectCSS();
        injectUI();
        console.info('[FW vs Impl Compliance] ✅ Loaded — project ZIP/JAR/WAR upload supported on both sides.');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
