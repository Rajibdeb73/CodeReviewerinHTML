/**
 * Framework vs Implementation Compliance Checker
 * Patch for code_review_enterprise release.html
 *
 * HOW TO USE:
 *   Add this line just before </body> in your HTML (after the adherence patch):
 *   <script src="code-review-framework-compliance.js"></script>
 *
 * What this adds:
 *   • "⚖️ Framework" tab in the upload section
 *   • Paste framework/standard code on the left, implementation on the right
 *   • Click "Analyse Compliance" → get a scored report showing:
 *       - Overall compliance % with grade
 *       - Per-category scores (annotations, interfaces, methods, imports, naming, error handling)
 *       - ✅ What's implemented correctly
 *       - ❌ What's missing or wrong
 *       - 💡 Fix suggestions for each violation
 */

(function () {
    'use strict';

    /* =========================================================
       1. EXTRACTION HELPERS
       ========================================================= */

    function extractInterfaces(code) {
        const found = [];
        const re = /\binterface\s+(\w+)/gm;
        let m;
        while ((m = re.exec(code))) found.push(m[1]);
        return found;
    }

    function extractAbstractMethods(code) {
        const found = [];
        const re = /\babstract\s+(?:[\w<>\[\]]+\s+)+(\w+)\s*\(([^)]*)\)/gm;
        let m;
        while ((m = re.exec(code))) found.push({ name: m[1], params: m[2].trim() });
        return found;
    }

    function extractInterfaceMethods(code) {
        const found = [];
        // Inside interface bodies — lines that look like method signatures (no body)
        const re = /(?:^|\n)\s*(?:(?:public|default|static)\s+)?(?!class|interface|enum)[\w<>\[\],\s]+\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*;/gm;
        let m;
        while ((m = re.exec(code))) found.push({ name: m[1], params: m[2].trim() });
        return found;
    }

    function extractAnnotations(code) {
        const found = new Set();
        const re = /@(\w+)(?:\s*\(|[\s\n])/gm;
        let m;
        while ((m = re.exec(code))) found.add(m[1]);
        return [...found];
    }

    function extractMethodSignatures(code) {
        const found = [];
        const re = /(?:public|protected|private)\s+(?:static\s+|final\s+|synchronized\s+)*(?:[\w<>\[\],\s]+)\s+(\w+)\s*\(([^)]*)\)/gm;
        let m;
        while ((m = re.exec(code))) {
            if (!['class','interface','enum','if','for','while','switch'].includes(m[1])) {
                found.push({ name: m[1], params: m[2].trim() });
            }
        }
        return found;
    }

    function extractClassNames(code) {
        const found = [];
        const re = /\bclass\s+(\w+)/gm;
        let m;
        while ((m = re.exec(code))) found.push(m[1]);
        return found;
    }

    function extractImports(code) {
        const found = [];
        const re = /^import\s+([\w.*]+)\s*;/gm;
        let m;
        while ((m = re.exec(code))) found.push(m[1]);
        return found;
    }

    function extractPackages(imports) {
        return imports.map(i => i.split('.').slice(0, -1).join('.'));
    }

    function extractExtendsImplements(code) {
        const result = { extends: [], implements: [] };
        const extRe = /\bextends\s+([\w,\s<>]+?)(?:\s+implements|\s*\{)/gm;
        const impRe = /\bimplements\s+([\w,\s<>]+?)(?:\s*\{)/gm;
        let m;
        while ((m = extRe.exec(code))) {
            result.extends.push(...m[1].split(',').map(s => s.trim().replace(/<.*>/, '')));
        }
        while ((m = impRe.exec(code))) {
            result.implements.push(...m[1].split(',').map(s => s.trim().replace(/<.*>/, '')));
        }
        return result;
    }

    function extractExceptionHandling(code) {
        return {
            hasTryCatch:        /\btry\s*\{/.test(code),
            catchCount:         (code.match(/\bcatch\s*\(/g) || []).length,
            hasFinally:         /\bfinally\s*\{/.test(code),
            throwsDeclarations: (code.match(/\bthrows\s+\w+/g) || []).length,
            customExceptions:   (code.match(/class\s+\w+Exception\b/g) || []).length,
            swallowsExceptions: /catch\s*\([^)]+\)\s*\{[\s\n]*\}/m.test(code) ||
                                /catch\s*\([^)]+\)\s*\{\s*\/\//m.test(code),
            logsExceptions:     /log\w*\.(error|warn|info)\s*\(/.test(code) ||
                                /logger\.(error|warn)\s*\(/.test(code),
            usesCustomEx:       /throw\s+new\s+\w+Exception/.test(code)
        };
    }

    function extractLoggingStyle(code) {
        return {
            hasLogger:      /\bLogger\b|\blog\b\s*=|\bLOGGER\b/.test(code),
            usesSlf4j:      /org\.slf4j|LoggerFactory\.getLogger/.test(code),
            usesLog4j:      /org\.apache\.logging|LogManager\.getLogger/.test(code),
            usesLombok:     /@Slf4j|@Log4j2|@CommonsLog/.test(code),
            logLevels:      {
                debug: /\.debug\s*\(/.test(code),
                info:  /\.info\s*\(/.test(code),
                warn:  /\.warn\s*\(/.test(code),
                error: /\.error\s*\(/.test(code)
            }
        };
    }

    function extractNamingConventions(code) {
        const classes  = (code.match(/\bclass\s+(\w+)/gm) || []).map(s => s.replace('class ', ''));
        const methods  = (code.match(/(?:public|private|protected)\s+\w+\s+(\w+)\s*\(/gm) || []);
        const fields   = (code.match(/private\s+(?:final\s+)?[\w<>]+\s+(\w+)\s*[=;]/gm) || []);
        return {
            classNames: classes,
            hasPascalCaseClasses: classes.every(c => /^[A-Z]/.test(c)),
            hasCamelCaseMethods: methods.every(m => /[a-z]\w+\s*\(/.test(m)),
            hasConstantsUpperCase: /\bstatic\s+final\s+\w+\s+([A-Z_]+)\s*=/.test(code),
            prefixPatterns: {
                iPrefix:   classes.some(c => /^I[A-Z]/.test(c)),  // IUserService
                implSuffix: classes.some(c => /Impl$/.test(c)),     // UserServiceImpl
                dtoSuffix:  classes.some(c => /Dto$|DTO$/.test(c)),
                repoSuffix: classes.some(c => /Repository$/.test(c))
            }
        };
    }

    /* =========================================================
       2. COMPLIANCE ANALYSIS ENGINE
       ========================================================= */

    function analyzeCompliance(frameworkCode, implCode) {
        const report = {
            categories: [],
            compliant:  [],
            violations: [],
            missing:    [],
            overall:    0,
            maxScore:   0
        };

        function addCategory(name, icon, checks) {
            let catScore = 0, catMax = 0;
            const items = [];
            checks.forEach(({ label, passed, weight, compliant, violation, suggestion }) => {
                catMax += weight;
                if (passed) {
                    catScore += weight;
                    if (compliant) report.compliant.push(compliant);
                } else {
                    if (violation)  report.violations.push({ label, violation, suggestion });
                    if (label)      report.missing.push(label);
                }
                items.push({ label, passed, weight });
            });
            report.overall  += catScore;
            report.maxScore += catMax;
            const pct = catMax > 0 ? Math.round(catScore / catMax * 100) : 100;
            report.categories.push({ name, icon, score: catScore, maxScore: catMax, percentage: pct, items });
        }

        const fwAnnotations  = extractAnnotations(frameworkCode);
        const implAnnotations = extractAnnotations(implCode);
        const fwInterfaces   = extractInterfaces(frameworkCode);
        const fwAbsMethods   = extractAbstractMethods(frameworkCode);
        const fwIfMethods    = extractInterfaceMethods(frameworkCode);
        const implMethods    = extractMethodSignatures(implCode);
        const fwImports      = extractImports(frameworkCode);
        const implImports    = extractImports(implCode);
        const fwHierarchy    = extractExtendsImplements(frameworkCode);
        const implHierarchy  = extractExtendsImplements(implCode);
        const fwEH           = extractExceptionHandling(frameworkCode);
        const implEH         = extractExceptionHandling(implCode);
        const fwLog          = extractLoggingStyle(frameworkCode);
        const implLog        = extractLoggingStyle(implCode);
        const fwNaming       = extractNamingConventions(frameworkCode);
        const implNaming     = extractNamingConventions(implCode);
        const fwPackages     = extractPackages(fwImports);
        const implMethodNames = implMethods.map(m => m.name);

        /* ── Category 1: Annotation Compliance ── */
        const criticalAnnotations = ['RestController','Controller','Service','Repository',
            'Component','Transactional','Autowired','RequestMapping','GetMapping',
            'PostMapping','PutMapping','DeleteMapping','Valid','NotNull','NotBlank',
            'Override','Slf4j','Log4j2','Aspect','Entity','Table'];
        const fwCritAnnotations = fwAnnotations.filter(a => criticalAnnotations.includes(a));

        addCategory('Annotation Compliance', '🏷️',
            fwCritAnnotations.length === 0
                ? [{ label: 'Framework defines annotations', passed: false, weight: 0,
                     violation: 'No annotations found in framework code to compare.',
                     suggestion: 'Ensure framework code contains Spring/Jakarta annotations.' }]
                : fwCritAnnotations.map(ann => ({
                    label: `@${ann} used`,
                    passed: implAnnotations.includes(ann),
                    weight: ['Service','Repository','RestController','Controller','Transactional','Valid'].includes(ann) ? 4 : 2,
                    compliant: `@${ann} correctly applied in implementation`,
                    violation:  `@${ann} defined in framework but missing in implementation`,
                    suggestion: `Add @${ann} to the appropriate class or method in your implementation`
                }))
        );

        /* ── Category 2: Interface & Abstract Class Compliance ── */
        const allRequiredMethods = [...fwAbsMethods, ...fwIfMethods];
        addCategory('Interface & Abstract Method Coverage', '🔌',
            fwInterfaces.length === 0 && allRequiredMethods.length === 0
                ? [{ label: 'Framework defines contracts', passed: false, weight: 0,
                     violation: 'No interfaces or abstract methods in framework code.',
                     suggestion: 'Define interfaces or abstract classes in the framework code.' }]
                : [
                    ...fwInterfaces.map(iface => ({
                        label: `Implements ${iface}`,
                        passed: implHierarchy.implements.includes(iface) ||
                                implCode.includes(`implements ${iface}`) ||
                                implCode.includes(`extends ${iface}`),
                        weight: 4,
                        compliant: `${iface} contract correctly implemented`,
                        violation:  `Interface ${iface} defined in framework but not implemented`,
                        suggestion: `public class YourClass implements ${iface} { /* implement all methods */ }`
                    })),
                    ...allRequiredMethods.map(m => ({
                        label: `Method ${m.name}() implemented`,
                        passed: implMethodNames.includes(m.name),
                        weight: 3,
                        compliant: `${m.name}() correctly overridden`,
                        violation:  `Required method ${m.name}() not implemented`,
                        suggestion: `@Override\npublic <ReturnType> ${m.name}(${m.params}) { /* your implementation */ }`
                    }))
                ]
        );

        /* ── Category 3: Import & Package Compliance ── */
        const fwUniquePackages = [...new Set(fwPackages)].filter(p => p.startsWith('org.spring') ||
            p.startsWith('javax.') || p.startsWith('jakarta.') || p.startsWith('org.slf4j'));
        addCategory('Import & Package Compliance', '📦',
            fwUniquePackages.length === 0
                ? [{ label: 'Framework defines packages', passed: true, weight: 1,
                     compliant: 'No specific framework packages required' }]
                : fwUniquePackages.map(pkg => {
                    const used = implImports.some(i => i.startsWith(pkg));
                    return {
                        label: `Uses ${pkg}.*`,
                        passed: used,
                        weight: 2,
                        compliant: `${pkg} packages properly imported`,
                        violation:  `Framework uses ${pkg} but implementation doesn't import it`,
                        suggestion: `import ${pkg}.*;  // or specific classes from this package`
                    };
                })
        );

        /* ── Category 4: Inheritance & Extension Compliance ── */
        const parentChecks = [];
        fwHierarchy.extends.filter(c => c && c !== 'Object').forEach(parent => {
            parentChecks.push({
                label: `Extends ${parent}`,
                passed: implHierarchy.extends.includes(parent) || implCode.includes(`extends ${parent}`),
                weight: 4,
                compliant: `Correctly extends framework base class ${parent}`,
                violation:  `Implementation should extend ${parent} (as framework requires) but doesn't`,
                suggestion: `public class YourClass extends ${parent} { ... }`
            });
        });
        if (parentChecks.length === 0) {
            parentChecks.push({
                label: 'No mandatory inheritance required',
                passed: true, weight: 1,
                compliant: 'Framework does not enforce specific inheritance'
            });
        }
        addCategory('Inheritance & Extension Compliance', '🧬', parentChecks);

        /* ── Category 5: Exception Handling Compliance ── */
        const ehChecks = [];
        if (fwEH.hasTryCatch) {
            ehChecks.push({
                label: 'Uses try-catch blocks',
                passed: implEH.hasTryCatch, weight: 3,
                compliant: 'Exception handling follows framework try-catch pattern',
                violation:  'Framework uses try-catch but implementation has none',
                suggestion: 'Wrap risky operations in try-catch matching framework pattern'
            });
        }
        if (fwEH.usesCustomEx) {
            ehChecks.push({
                label: 'Throws custom exception types',
                passed: implEH.usesCustomEx, weight: 3,
                compliant: 'Custom exceptions used as per framework pattern',
                violation:  'Framework throws custom exceptions but impl uses generic RuntimeException',
                suggestion: 'throw new YourCustomException("message"); — avoid plain RuntimeException'
            });
        }
        if (fwEH.logsExceptions) {
            ehChecks.push({
                label: 'Logs exceptions (no silent swallowing)',
                passed: implEH.logsExceptions && !implEH.swallowsExceptions, weight: 3,
                compliant: 'Exceptions are properly logged',
                violation:  implEH.swallowsExceptions
                    ? 'Exceptions silently swallowed (empty catch block or comment-only body)'
                    : 'Framework logs exceptions but implementation does not',
                suggestion: 'log.error("Failed: {}", e.getMessage(), e);  // always log with cause'
            });
        }
        if (!fwEH.hasTryCatch && !fwEH.usesCustomEx) {
            ehChecks.push({ label: 'Error handling style matches', passed: true, weight: 1,
                compliant: 'No specific error handling pattern mandated by framework' });
        }
        addCategory('Exception Handling Compliance', '⚠️', ehChecks);

        /* ── Category 6: Logging Compliance ── */
        const logChecks = [];
        if (fwLog.hasLogger) {
            logChecks.push({
                label: 'Logger declared',
                passed: implLog.hasLogger, weight: 2,
                compliant: 'Logger correctly declared in implementation',
                violation:  'Framework declares a logger but implementation does not',
                suggestion: fwLog.usesLombok
                    ? '@Slf4j  // add Lombok annotation to class'
                    : 'private static final Logger log = LoggerFactory.getLogger(YourClass.class);'
            });
            if (fwLog.usesSlf4j) {
                logChecks.push({
                    label: 'Uses SLF4J (consistent logging framework)',
                    passed: implLog.usesSlf4j || implLog.usesLombok, weight: 2,
                    compliant: 'SLF4J logging framework consistent with framework standard',
                    violation:  'Framework uses SLF4J but implementation uses a different logger',
                    suggestion: 'import org.slf4j.Logger; import org.slf4j.LoggerFactory;'
                });
            }
            if (fwLog.usesLombok) {
                logChecks.push({
                    label: 'Uses @Slf4j / @Log4j2 Lombok annotation',
                    passed: implLog.usesLombok, weight: 2,
                    compliant: '@Slf4j annotation used consistently',
                    violation:  'Framework uses Lombok @Slf4j but implementation manually declares logger',
                    suggestion: '@Slf4j\npublic class YourClass { ... }  // Lombok generates log field'
                });
            }
            if (fwLog.logLevels.debug) {
                logChecks.push({
                    label: 'Uses debug-level logging',
                    passed: implLog.logLevels.debug, weight: 1,
                    compliant: 'Debug logging present for diagnostics',
                    violation:  'Framework uses debug logging; implementation only has info/error',
                    suggestion: 'log.debug("Processing: {}", input);  // add debug for key steps'
                });
            }
        } else {
            logChecks.push({ label: 'No logging standard mandated', passed: true, weight: 1,
                compliant: 'Framework does not define a specific logging pattern' });
        }
        addCategory('Logging Compliance', '📋', logChecks);

        /* ── Category 7: Naming Convention Compliance ── */
        const namingChecks = [];
        if (fwNaming.prefixPatterns.implSuffix) {
            namingChecks.push({
                label: 'Implementation classes use "Impl" suffix',
                passed: implNaming.prefixPatterns.implSuffix, weight: 2,
                compliant: 'Impl naming convention followed',
                violation:  'Framework uses *Impl suffix naming but implementation does not',
                suggestion: 'Rename: class UserServiceImpl implements UserService { ... }'
            });
        }
        if (fwNaming.prefixPatterns.dtoSuffix) {
            namingChecks.push({
                label: 'DTOs use "Dto" or "DTO" suffix',
                passed: implNaming.prefixPatterns.dtoSuffix, weight: 2,
                compliant: 'DTO naming convention followed',
                violation:  'Framework uses *Dto naming but implementation does not',
                suggestion: 'Rename: class UserDto { ... } or class UserDTO { ... }'
            });
        }
        if (fwNaming.prefixPatterns.repoSuffix) {
            namingChecks.push({
                label: 'Repositories use "Repository" suffix',
                passed: implNaming.prefixPatterns.repoSuffix, weight: 2,
                compliant: 'Repository naming convention followed',
                violation:  'Framework uses *Repository naming but implementation does not',
                suggestion: 'Rename: interface UserRepository extends JpaRepository<User, Long>'
            });
        }
        namingChecks.push({
            label: 'Classes use PascalCase',
            passed: implNaming.hasPascalCaseClasses, weight: 2,
            compliant: 'PascalCase class naming correct',
            violation:  'Class names do not follow PascalCase convention',
            suggestion: 'Rename classes to start with uppercase: class UserService (not userService)'
        });
        if (namingChecks.length === 1) {
            namingChecks.push({ label: 'Framework naming pattern matched', passed: true, weight: 1,
                compliant: 'No specific naming pattern enforced by framework' });
        }
        addCategory('Naming Convention Compliance', '🏷️', namingChecks);

        /* ── Category 8: Structural Pattern Compliance ── */
        const structChecks = [];
        const fwUsesConstructorInj = /private\s+final\s+\w+\s+\w+/m.test(frameworkCode) ||
                                     /@RequiredArgsConstructor/.test(frameworkCode);
        const implUsesConstructorInj = /private\s+final\s+\w+\s+\w+/m.test(implCode) ||
                                      /@RequiredArgsConstructor/.test(implCode);
        const fwUsesFieldInj = /@Autowired\b/.test(frameworkCode);
        const implUsesFieldInj = /@Autowired\b/.test(implCode);

        if (fwUsesConstructorInj) {
            structChecks.push({
                label: 'Constructor injection used (not field injection)',
                passed: implUsesConstructorInj, weight: 4,
                compliant: 'Constructor injection follows framework pattern',
                violation:  'Framework uses constructor injection but implementation uses @Autowired field injection',
                suggestion: 'private final UserService service; // with constructor or @RequiredArgsConstructor'
            });
        }
        if (fwUsesFieldInj && !fwUsesConstructorInj) {
            structChecks.push({
                label: 'Field injection style consistent',
                passed: implUsesFieldInj, weight: 2,
                compliant: 'Field injection style consistent with framework',
                violation:  'Framework uses @Autowired field injection; implementation does not inject dependencies',
                suggestion: '@Autowired\nprivate UserService service;'
            });
        }

        const fwUsesResponseEntity = /ResponseEntity/.test(frameworkCode);
        if (fwUsesResponseEntity) {
            structChecks.push({
                label: 'Returns ResponseEntity (not raw objects)',
                passed: /ResponseEntity/.test(implCode), weight: 3,
                compliant: 'ResponseEntity return type consistent with framework',
                violation:  'Framework returns ResponseEntity but implementation returns raw objects',
                suggestion: 'public ResponseEntity<UserDto> getUser(Long id) { return ResponseEntity.ok(dto); }'
            });
        }

        const fwUsesOptional = /Optional</.test(frameworkCode);
        if (fwUsesOptional) {
            structChecks.push({
                label: 'Uses Optional<> for nullable returns',
                passed: /Optional</.test(implCode), weight: 2,
                compliant: 'Optional<> pattern consistent with framework',
                violation:  'Framework uses Optional<> but implementation can return null',
                suggestion: 'public Optional<User> findById(Long id) { return repo.findById(id); }'
            });
        }

        if (structChecks.length === 0) {
            structChecks.push({ label: 'Structural patterns match', passed: true, weight: 1,
                compliant: 'No specific structural patterns mandated' });
        }
        addCategory('Structural Pattern Compliance', '🏗️', structChecks);

        /* ── Final score ── */
        const pct = report.maxScore > 0
            ? Math.round(report.overall / report.maxScore * 100) : 0;
        report.percentage = pct;
        report.grade = pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
        report.gradeColor = pct >= 85 ? '#3fb950' : pct >= 70 ? '#d29922' : pct >= 55 ? '#f0883e' : '#f85149';

        return report;
    }

    /* =========================================================
       3. RENDER COMPLIANCE REPORT
       ========================================================= */

    function renderComplianceReport(report, fwName, implName) {
        const container = document.getElementById('fc-results');
        if (!container) return;

        const gradeColor = report.gradeColor;

        container.innerHTML = `
            <!-- Hero row -->
            <div style="display:grid;grid-template-columns:auto 1fr;gap:1.5rem;align-items:center;
                        margin-bottom:2rem;background:var(--bg-tertiary);border:1px solid var(--border);
                        border-radius:12px;padding:1.5rem">
                <div style="text-align:center">
                    <div style="font-size:3.5rem;font-weight:900;color:${gradeColor};line-height:1">${report.grade}</div>
                    <div style="font-size:1.1rem;font-weight:700;color:${gradeColor}">${report.percentage}%</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.25rem">COMPLIANCE</div>
                </div>
                <div>
                    <div style="height:10px;background:var(--bg-primary);border-radius:5px;overflow:hidden;margin-bottom:1rem">
                        <div style="height:100%;width:${report.percentage}%;background:${gradeColor};
                                    border-radius:5px;transition:width 0.6s ease"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem">
                        <div style="text-align:center">
                            <div style="font-size:1.4rem;font-weight:700;color:#3fb950">${report.compliant.length}</div>
                            <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase">Compliant</div>
                        </div>
                        <div style="text-align:center">
                            <div style="font-size:1.4rem;font-weight:700;color:#f85149">${report.violations.length}</div>
                            <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase">Violations</div>
                        </div>
                        <div style="text-align:center">
                            <div style="font-size:1.4rem;font-weight:700;color:#d29922">${report.missing.length}</div>
                            <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase">Missing</div>
                        </div>
                    </div>
                    <div style="margin-top:0.75rem;font-size:0.78rem;color:var(--text-muted)">
                        <span style="color:var(--accent-blue)">${implName}</span>
                        vs framework
                        <span style="color:var(--accent-purple)">${fwName}</span>
                    </div>
                </div>
            </div>

            <!-- Category breakdown -->
            <div style="font-size:1rem;font-weight:600;margin-bottom:1rem;color:var(--text-primary)">📊 Category Breakdown</div>
            ${report.categories.map(cat => renderCategoryCard(cat)).join('')}

            <!-- Violations -->
            ${report.violations.length ? `
            <div style="font-size:1rem;font-weight:600;margin:1.5rem 0 1rem;color:#f85149">❌ Violations (${report.violations.length})</div>
            ${report.violations.map(v => `
                <div style="background:#1a0808;border:1px solid rgba(248,81,73,0.3);border-radius:8px;
                            padding:1rem;margin-bottom:0.75rem">
                    <div style="font-size:0.78rem;font-weight:600;color:#f85149;margin-bottom:0.4rem">${v.label}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.5rem">${v.violation}</div>
                    ${v.suggestion ? `<div style="font-size:0.75rem;color:#3fb950;font-family:'Fira Code',monospace;
                        background:var(--bg-primary);padding:0.5rem 0.75rem;border-radius:4px;
                        border-left:2px solid #3fb950;white-space:pre-wrap">💡 ${v.suggestion}</div>` : ''}
                </div>`).join('')}` : ''}

            <!-- Compliant items -->
            ${report.compliant.length ? `
            <div style="font-size:1rem;font-weight:600;margin:1.5rem 0 1rem;color:#3fb950">✅ Compliant Items (${report.compliant.length})</div>
            <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:1rem">
                ${report.compliant.map(c => `
                    <div style="display:flex;align-items:center;gap:0.6rem;padding:0.3rem 0;
                                font-size:0.8rem;color:var(--text-secondary);
                                border-bottom:1px solid rgba(48,54,61,0.4)">
                        <span style="color:#3fb950;flex-shrink:0">✓</span>${c}
                    </div>`).join('')}
            </div>` : ''}
        `;
    }

    function renderCategoryCard(cat) {
        const color = cat.percentage >= 80 ? '#3fb950'
                    : cat.percentage >= 60 ? '#d29922'
                    : cat.percentage >= 40 ? '#f0883e' : '#f85149';
        return `
            <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;
                        padding:1rem;margin-bottom:0.75rem">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.6rem">
                    <span style="font-size:1.1rem">${cat.icon}</span>
                    <span style="font-weight:600;font-size:0.9rem;flex:1">${cat.name}</span>
                    <span style="font-weight:800;color:${color};font-size:1rem">${cat.percentage}%</span>
                    <span style="font-size:0.7rem;color:var(--text-muted)">${cat.score}/${cat.maxScore}pt</span>
                </div>
                <div style="height:5px;background:var(--bg-primary);border-radius:3px;overflow:hidden;margin-bottom:0.75rem">
                    <div style="height:100%;width:${cat.percentage}%;background:${color};border-radius:3px;transition:width 0.5s ease"></div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:0.35rem">
                    ${cat.items.map(item => `
                        <span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.2rem 0.55rem;
                                     border-radius:10px;font-size:0.69rem;
                                     background:${item.passed ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)'};
                                     color:${item.passed ? '#3fb950' : '#f85149'};
                                     border:1px solid ${item.passed ? '#3fb95044' : '#f8514944'}">
                            ${item.passed ? '✓' : '✗'} ${item.label}
                        </span>`).join('')}
                </div>
            </div>`;
    }

    /* =========================================================
       4. INJECT "Framework" UPLOAD TAB UI
       ========================================================= */

    function injectFrameworkTab() {
        /* ── Tab button ── */
        const tabBar = document.querySelector('.upload-tabs');
        if (!tabBar || tabBar.querySelector('[data-fc-tab]')) return;

        const tabBtn = document.createElement('button');
        tabBtn.className = 'upload-tab';
        tabBtn.dataset.fcTab = 'framework';
        tabBtn.innerHTML = '⚖️ Framework Compliance';
        tabBtn.addEventListener('click', () => activateFcTab());
        tabBar.appendChild(tabBtn);

        /* ── Tab panel ── */
        const uploadContent = document.querySelector('.upload-content');
        if (!uploadContent) return;

        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.id = 'fc-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div style="margin-bottom:1rem">
                <div style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:1rem">
                    Paste your <strong style="color:var(--accent-purple)">framework / standard code</strong>
                    on the left and your <strong style="color:var(--accent-blue)">implementation code</strong>
                    on the right. The tool will score how well the implementation follows the framework.
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                    <!-- Framework pane -->
                    <div>
                        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;flex-wrap:wrap">
                            <label style="font-size:0.82rem;font-weight:600;color:var(--accent-purple)">
                                📐 Framework / Standard Code
                            </label>
                            <input id="fc-fw-name" class="paste-input" placeholder="e.g. BaseService.java"
                                style="flex:1;min-width:140px;font-size:0.8rem">
                        </div>
                        <textarea id="fc-fw-code" class="code-textarea" rows="18"
                            placeholder="Paste your framework, base class, interface, or coding standard here...

Example:
@Service
public abstract class BaseService&lt;T&gt; {
    protected final Logger log = LoggerFactory.getLogger(getClass());

    @Transactional
    public abstract T create(T entity);

    public abstract Optional&lt;T&gt; findById(Long id);
}"></textarea>
                    </div>
                    <!-- Implementation pane -->
                    <div>
                        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;flex-wrap:wrap">
                            <label style="font-size:0.82rem;font-weight:600;color:var(--accent-blue)">
                                🔧 Implementation Code
                            </label>
                            <input id="fc-impl-name" class="paste-input" placeholder="e.g. UserServiceImpl.java"
                                style="flex:1;min-width:140px;font-size:0.8rem">
                        </div>
                        <textarea id="fc-impl-code" class="code-textarea" rows="18"
                            placeholder="Paste your implementation code here...

Example:
public class UserService {
    @Autowired
    private UserRepository repo;

    public User create(User user) {
        return repo.save(user);
    }
}"></textarea>
                    </div>
                </div>
                <div style="display:flex;gap:0.75rem;margin-top:1rem;align-items:center;flex-wrap:wrap">
                    <button id="fc-analyse-btn" class="btn btn-primary" onclick="window._fcRunAnalysis()">
                        ⚖️ Analyse Compliance
                    </button>
                    <button class="btn" onclick="window._fcLoadSample()">
                        🧪 Load Bad Sample
                    </button>
                    <button class="btn btn-sm" onclick="document.getElementById('fc-fw-code').value='';
                        document.getElementById('fc-impl-code').value='';
                        document.getElementById('fc-results-section').style.display='none'">
                        🗑 Clear
                    </button>
                    <span id="fc-status" style="font-size:0.8rem;color:var(--text-muted)"></span>
                </div>
            </div>

            <!-- Results -->
            <div id="fc-results-section" style="display:none;margin-top:1.5rem;
                background:var(--bg-secondary);border:1px solid var(--border);
                border-radius:12px;overflow:hidden">
                <div style="background:var(--bg-tertiary);padding:1rem 1.5rem;border-bottom:1px solid var(--border);
                            display:flex;justify-content:space-between;align-items:center">
                    <div style="font-weight:700;font-size:1rem;background:linear-gradient(135deg,#58a6ff,#bc8cff);
                                -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                                background-clip:text">⚖️ Compliance Report</div>
                    <button class="btn btn-sm" onclick="window._fcExport()">📄 Export</button>
                </div>
                <div id="fc-results" style="padding:1.5rem;max-height:70vh;overflow-y:auto"></div>
            </div>
        `;
        uploadContent.appendChild(panel);
    }

    /* ── Activate tab ── */
    function activateFcTab() {
        document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });
        const btn = document.querySelector('[data-fc-tab]');
        const panel = document.getElementById('fc-panel');
        if (btn) btn.classList.add('active');
        if (panel) { panel.classList.add('active'); panel.style.display = 'block'; }
    }

    /* =========================================================
       5. GLOBAL ANALYSIS TRIGGER
       ========================================================= */

    window._fcRunAnalysis = function () {
        const fwCode   = (document.getElementById('fc-fw-code')   || {}).value || '';
        const implCode = (document.getElementById('fc-impl-code') || {}).value || '';
        const fwName   = (document.getElementById('fc-fw-name')   || {}).value || 'Framework';
        const implName = (document.getElementById('fc-impl-name') || {}).value || 'Implementation';
        const status   = document.getElementById('fc-status');
        const section  = document.getElementById('fc-results-section');

        if (!fwCode.trim() || !implCode.trim()) {
            if (status) { status.textContent = '⚠️ Please paste both framework and implementation code.'; }
            return;
        }
        if (status) status.textContent = 'Analysing…';

        setTimeout(() => {
            const report = analyzeCompliance(fwCode, implCode);
            renderComplianceReport(report, fwName, implName);
            if (section) section.style.display = '';
            if (status) status.textContent = `Done — ${report.percentage}% compliant (${report.violations.length} violations)`;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    /* =========================================================
       6. LOAD BAD SAMPLE (framework vs broken impl)
       ========================================================= */

    const SAMPLE_FRAMEWORK = `import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

/**
 * FRAMEWORK STANDARD: All services must extend this base class.
 * - Constructor injection only (no @Autowired fields)
 * - @Transactional on all write methods
 * - SLF4J logging via log field
 * - Custom exceptions (never plain RuntimeException)
 * - Returns Optional<T> for nullable finds
 * - ResponseEntity for all controller returns
 */
public abstract class BaseService<T, ID> {

    protected final Logger log = LoggerFactory.getLogger(getClass());

    @Transactional
    public abstract T create(T entity);

    @Transactional
    public abstract T update(ID id, T entity);

    @Transactional
    public abstract void delete(ID id);

    public abstract Optional<T> findById(ID id);

    protected void validateNotNull(Object value, String fieldName) {
        if (value == null) throw new ValidationException(fieldName + " must not be null");
    }
}`;

    const SAMPLE_IMPL = `import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

// BAD: Many violations against the framework standard above
// Missing @Service is marked but present. Field injection used.
// No extends BaseService. No SLF4J logger. No @Transactional.
// Returns null instead of Optional. Swallows exceptions.

@Service
public class UserService {

    // VIOLATION: field injection instead of constructor injection
    @Autowired
    private UserRepository userRepository;

    // VIOLATION: no @Transactional on write method
    // VIOLATION: returns raw User not declared in base contract
    public User create(User user) {
        if (user == null) return null;      // returns null instead of Optional
        return userRepository.save(user);
    }

    // VIOLATION: no @Transactional
    // VIOLATION: no logging
    public User update(Long id, User updated) {
        User existing = userRepository.findById(id).orElse(null);
        if (existing == null) {
            throw new RuntimeException("Not found"); // VIOLATION: plain RuntimeException
        }
        existing.setName(updated.getName());
        return userRepository.save(existing);
    }

    // VIOLATION: no @Transactional
    // VIOLATION: swallowing exception silently
    public void delete(Long id) {
        try {
            userRepository.deleteById(id);
        } catch (Exception e) {
            // silent swallow — no log, no rethrow
        }
    }

    // VIOLATION: returns null instead of Optional<User>
    public User findById(Long id) {
        return userRepository.findById(id).orElse(null);
    }
}`;

    window._fcLoadSample = function () {
        const fw   = document.getElementById('fc-fw-code');
        const impl = document.getElementById('fc-impl-code');
        const fn   = document.getElementById('fc-fw-name');
        const in_  = document.getElementById('fc-impl-name');
        if (fw)   fw.value   = SAMPLE_FRAMEWORK;
        if (impl) impl.value = SAMPLE_IMPL;
        if (fn)   fn.value   = 'BaseService.java';
        if (in_)  in_.value  = 'UserService.java (bad impl)';
        const status = document.getElementById('fc-status');
        if (status) status.textContent = 'Sample loaded — click Analyse Compliance.';
    };

    /* =========================================================
       7. EXPORT
       ========================================================= */

    window._fcExport = function () {
        const el = document.getElementById('fc-results');
        if (!el || !el.innerHTML) return;
        const blob = new Blob([
            `<!DOCTYPE html><html><head><meta charset="UTF-8">
             <title>Compliance Report</title>
             <style>body{font-family:Arial,sans-serif;background:#0d1117;color:#c9d1d9;padding:2rem}
             </style></head><body>${el.innerHTML}</body></html>`
        ], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `compliance-report-${Date.now()}.html`;
        a.click();
    };

    /* =========================================================
       8. INIT
       ========================================================= */

    function init() {
        injectFrameworkTab();
        // Responsive tweak: stack panels on narrow screens
        const style = document.createElement('style');
        style.textContent = `
            @media(max-width:800px){
                #fc-panel [style*="grid-template-columns:1fr 1fr"]{
                    grid-template-columns:1fr !important;
                }
            }
        `;
        document.head.appendChild(style);
        console.info('[Framework Compliance] ✅ Loaded — Framework vs Implementation checker active.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
