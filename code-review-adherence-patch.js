/**
 * Design Pattern Adherence Checker — Patch for code_review_enterprise release.html
 *
 * HOW TO USE:
 *   Add this line just before </body> in your existing HTML file:
 *   <script src="code-review-adherence-patch.js"></script>
 *
 * What this adds:
 *   • "📐 Adherence" tab in the results panel — shows per-criterion scoring
 *   • Adherence grade (A/B/C/F) and % score for every detected pattern
 *   • Violations list with fix suggestions for failing criteria
 *   • "🧪 Load Sample (Failing)" button in the header — loads 5 deliberately
 *     bad Java files that will trigger pattern detections AND fail adherence checks
 */

(function () {
    'use strict';

    /* =========================================================
       1. ADHERENCE CRITERIA ENGINE
       ========================================================= */

    function checkPatternAdherence(code, patternName) {
        const criteria = [];
        const violations = [];
        const suggestions = [];
        let score = 0;
        let maxScore = 0;

        function criterion(label, passed, weight, violation, suggestion) {
            criteria.push({ label, passed, weight });
            maxScore += weight;
            if (passed) {
                score += weight;
            } else {
                if (violation)  violations.push(violation);
                if (suggestion) suggestions.push(suggestion);
            }
        }

        switch (patternName) {

            /* ── CREATIONAL ── */

            case 'Singleton':
                criterion('Private constructor',
                    /private\s+\w+\s*\(\s*\)/m.test(code), 3,
                    'Constructor is not private — allows unrestricted instantiation by any caller.',
                    'private YourClass() { /* no-args private constructor */ }');

                criterion('Thread-safe instantiation (volatile / synchronized / enum)',
                    /volatile\s+/m.test(code) || /synchronized\s*\(/m.test(code) || /\benum\s+\w+/.test(code), 3,
                    'Not thread-safe — lazy initialisation without volatile is broken under the Java Memory Model.',
                    'Declare: private static volatile YourClass instance; and wrap creation in synchronized block.');

                criterion('No public constructor',
                    !/public\s+\w+\s*\(\s*\)/m.test(code), 3,
                    'Public constructor detected — defeats singleton guarantee; callers can always create new instances.',
                    'Remove public constructors; keep only the private no-args constructor.');

                criterion('Static factory method (getInstance)',
                    /static[^(]+getInstance\s*\(/m.test(code), 2,
                    'Missing getInstance() factory method — no controlled access point.',
                    'public static YourClass getInstance() { if (instance==null) { synchronized(YourClass.class) { if (instance==null) instance=new YourClass(); } } return instance; }');

                criterion('Instance field is private (not publicly accessible)',
                    !/public\s+static\s+\w+\s+\w*[Ii]nstance/m.test(code), 2,
                    'Static instance is public — external code can reassign it, breaking the singleton.',
                    'private static volatile YourClass instance;  // never public');
                break;

            case 'Builder':
                criterion('Static inner Builder class',
                    /static\s+(?:final\s+)?class\s+\w*Builder\b/m.test(code) || /@Builder\b/m.test(code), 3,
                    'Builder is not a static inner class — instances require an outer object to exist.',
                    'public static class Builder { ... }  // must be static');

                criterion('Fluent method chaining (returns Builder)',
                    /return\s+this\s*;/m.test(code) || /@Builder\b/m.test(code), 3,
                    'Setter methods do not return Builder (no fluent interface) — callers cannot chain calls.',
                    'public Builder name(String n) { this.name = n; return this; }');

                criterion('build() method present',
                    /public\s+\w+\s+build\s*\(\s*\)/m.test(code) || /@Builder\b/m.test(code), 2,
                    'Missing build() method — no way to construct the final product.',
                    'public YourProduct build() { validate(); return new YourProduct(this); }');

                criterion('Validates required fields in build()',
                    /Objects\.requireNonNull|requireNonNull|if\s*\(.*==\s*null.*\)\s*throw|@NonNull/.test(code), 2,
                    'build() does not validate required fields — silent nulls reach production.',
                    'Objects.requireNonNull(name, "name is required");  inside build()');

                criterion('Product has immutable (final) fields',
                    /private\s+final\s+\w+\s+\w+/m.test(code), 2,
                    'Product fields are not final — object can be mutated after construction, defeating immutability.',
                    'private final String name;  // all product fields should be final');
                break;

            case 'Factory Method':
                criterion('Factory returns interface or abstract type',
                    /(?:interface|abstract\s+class)\s+\w+/m.test(code), 3,
                    'Factory returns concrete types — violates Dependency Inversion Principle.',
                    'Define a product interface: public interface Notification { void send(); }');

                criterion('No instanceof checks inside factory',
                    !/\binstanceof\s+\w+/m.test(code), 3,
                    'instanceof inside factory violates Open/Closed Principle — adding a type requires changing the factory.',
                    'Use a registry Map<String, Supplier<Product>> or enum dispatch instead of instanceof chains.');

                criterion('Dedicated Factory class exists',
                    /class\s+\w*Factory\b/m.test(code), 2,
                    'No dedicated Factory class — creation logic embedded inside product or caller.',
                    'Extract to: public class NotificationFactory { public Notification create(String type) {...} }');

                criterion('Factory is extensible (registry / Map)',
                    /Map<|register\w*\s*\(|\.put\s*\(/m.test(code), 2,
                    'Hard-coded if/switch — every new product type requires editing the factory.',
                    'Map<String, Supplier<Product>> registry = new HashMap<>(); registry.put("email", EmailNotification::new);');
                break;

            case 'Prototype':
                criterion('Overrides clone() method',
                    /public\s+\w+\s+clone\s*\(\s*\)/m.test(code), 3,
                    'Missing clone() override — inherits shallow Object.clone() which may copy references.',
                    '@Override public YourClass clone() { return (YourClass) super.clone(); /* deep copy fields */ }');

                criterion('Handles CloneNotSupportedException',
                    /CloneNotSupportedException|try\s*\{[^}]+clone\(\)/.test(code), 2,
                    'CloneNotSupportedException not handled — runtime crash if Cloneable contract breaks.',
                    'Catch or declare CloneNotSupportedException; prefer copy-constructor over clone().');
                break;

            /* ── STRUCTURAL ── */

            case 'Adapter':
                criterion('Adapter delegates to adaptee (not extends)',
                    /private\s+(?:final\s+)?\w+\s+adaptee/m.test(code) || /composition/.test(code), 3,
                    'Adapter extends adaptee (class adapter) — prefer composition; class adapter couples to implementation.',
                    'private final LegacySystem adaptee;  // object adapter via composition');

                criterion('Adapter implements target interface',
                    /implements\s+\w+/m.test(code), 3,
                    'Adapter does not implement target interface — clients cannot use it polymorphically.',
                    'public class LegacyAdapter implements ModernPaymentGateway { ... }');

                criterion('No business logic inside adapter',
                    !/if\s*\(|for\s*\(|while\s*\(/.test(code), 2,
                    'Business logic inside adapter — adapter should only translate calls, not process data.',
                    'Keep adapter thin: translate method names and parameter types only; no if/for/while logic.');
                break;

            case 'Decorator':
                criterion('Decorator wraps the same interface it implements',
                    /implements\s+(\w+)/.test(code) && /private\s+(?:final\s+)?\w+\s+\w+;/m.test(code), 3,
                    'Decorator does not hold a reference to the component it wraps.',
                    'Store the wrapped component: private final Component component;');

                criterion('Delegates to wrapped component',
                    /component\.|wrapped\.|delegate\.|\bsuper\./m.test(code), 3,
                    'Decorator does not delegate to the wrapped component — completely replaces behaviour.',
                    'component.operation();  // always delegate before/after adding behaviour');
                break;

            case 'Facade':
                criterion('Facade exposes simplified interface',
                    /public\s+(?:void|[\w<>]+)\s+\w+\s*\([^)]*\)/m.test(code), 2,
                    'Facade exposes no public simplified methods.',
                    'Provide simple methods that orchestrate the complex subsystem internally.');

                criterion('Subsystem components are private',
                    /private\s+(?:final\s+)?\w+Service|private\s+(?:final\s+)?\w+Manager/m.test(code), 2,
                    'Subsystem components are publicly accessible — clients can bypass the facade.',
                    'Keep all subsystem references private; expose only the facade methods.');
                break;

            /* ── ENTERPRISE / SPRING ── */

            case 'Repository':
                criterion('No business logic in repository',
                    !(/if\s*\([^)]{10,}\)\s*\{[\s\n\r]*(?:throw|return\s+(?!em\.|entityManager))/m.test(code)), 4,
                    'Business logic (validation, rules, decisions) detected inside repository — violates SRP.',
                    'Move all business logic to Service layer; repository should only perform CRUD.');

                criterion('Extends Spring Data repository interface',
                    /extends\s+(?:Jpa|Crud|Mongo|Page|Reactive)Repository/m.test(code), 3,
                    'Not extending a Spring Data interface — raw EntityManager/JDBC is fragile and verbose.',
                    'public interface UserRepository extends JpaRepository<User, Long> { }');

                criterion('No transaction management in repository',
                    !/@Transactional\b/m.test(code) || /extends\s+(?:Jpa|Crud)Repository/m.test(code), 2,
                    '@Transactional in repository layer — transaction boundaries belong in the Service layer.',
                    'Remove @Transactional from repository; add it to @Service methods that modify data.');

                criterion('Defined as interface (not class)',
                    /\binterface\s+\w*Repository/m.test(code), 2,
                    'Repository is a concrete class — harder to mock in unit tests.',
                    'public interface UserRepository extends JpaRepository<User, Long> { /* Spring generates impl */ }');
                break;

            case 'Service Layer':
                criterion('@Service annotation present',
                    /@Service\b/m.test(code), 3,
                    'Missing @Service — Spring cannot detect and manage this bean.',
                    '@Service\npublic class UserService { ... }');

                criterion('No direct EntityManager / JDBC in service',
                    !/EntityManager|JdbcTemplate|DriverManager\.getConnection|ResultSet\b/m.test(code), 4,
                    'Direct database access in Service layer — violates layered architecture.',
                    'Use injected Repository interfaces exclusively; never touch EntityManager in a service.');

                criterion('Uses constructor injection (final fields)',
                    /private\s+final\s+\w+(?:Repository|Service)\s+\w+/m.test(code) ||
                    /@RequiredArgsConstructor/m.test(code), 2,
                    'Using field @Autowired — constructor injection is preferred; final fields enforce immutability.',
                    '@RequiredArgsConstructor  or  explicit constructor with private final fields');

                criterion('@Transactional on write operations',
                    /@Transactional\b/m.test(code), 2,
                    'No @Transactional — write operations will not roll back atomically on exception.',
                    '@Transactional\npublic void createOrder(OrderDto dto) { ... }');
                break;

            case 'MVC (Spring MVC)':
                criterion('No business logic in controller',
                    !/\b(for|while)\s*\(/.test(code) &&
                    !/\.stream\(\).*\.filter\(/.test(code), 4,
                    'Business logic (loops, stream processing) detected in controller — violates MVC separation.',
                    'Delegate everything to Service layer; controller should only: map request → call service → return response.');

                criterion('No repository injected directly in controller',
                    !/\w+Repository\s+\w+/m.test(code), 3,
                    'Repository injected directly into controller — bypasses Service layer.',
                    'Inject only Services: private final UserService userService;  // never a Repository');

                criterion('Returns DTO / ResponseEntity (not domain @Entity)',
                    /ResponseEntity|DTO|Dto|Response\b/m.test(code), 2,
                    'Returning domain @Entity objects from controller — leaks internal model and risks lazy-load errors.',
                    'Create response DTOs: public ResponseEntity<UserDto> getUser(...) { return ResponseEntity.ok(dto); }');

                criterion('Request body validated with @Valid',
                    /@Valid\b|@Validated\b/m.test(code), 2,
                    'No @Valid on @RequestBody — input can arrive in any state; bean validation is bypassed.',
                    'public ResponseEntity<?> create(@Valid @RequestBody UserDto dto) { ... }');
                break;

            case 'Dependency Injection':
                criterion('Constructor injection used (not field injection)',
                    /private\s+final\s+\w+\s+\w+/m.test(code) || /@RequiredArgsConstructor/m.test(code), 4,
                    'Field @Autowired injection used — cannot construct the class in unit tests without Spring context.',
                    'Use constructor injection: private final UserService service; with a constructor or @RequiredArgsConstructor');

                criterion('No "new" for Spring-managed beans',
                    !/=\s*new\s+\w+(?:Service|Repository|Component|Bean)\b/m.test(code), 3,
                    '"new" used to create Spring-managed beans — bypasses IoC container; no AOP, no lifecycle management.',
                    'Let Spring inject all @Service / @Repository / @Component beans; never call new on them.');

                criterion('Depends on interfaces not implementations',
                    /private\s+(?:final\s+)?(?!UserServiceImpl|OrderServiceImpl)\w+Service\s+\w+/m.test(code) ||
                    /private\s+(?:final\s+)?(?!UserRepositoryImpl)\w+Repository\s+\w+/m.test(code), 2,
                    'Injecting concrete implementation class instead of its interface — couples to implementation.',
                    'private final UserService service;  // interface, not UserServiceImpl');
                break;

            case 'AOP (Aspect-Oriented)':
                criterion('@Aspect annotation present',
                    /@Aspect\b/m.test(code), 3,
                    'Missing @Aspect — Spring cannot register this class as an aspect.',
                    '@Aspect\n@Component\npublic class AuditAspect { ... }');

                criterion('Pointcut is sufficiently specific (not global wildcard)',
                    !/@Pointcut\s*\(\s*"execution\s*\(\s*\*\s+\*\.\*\s*\(/m.test(code), 3,
                    'Overly broad pointcut execution(* *.*(..)) — will intercept all methods including framework internals.',
                    '"execution(* com.example.service.*.*(..))"  // at minimum scope to your package');

                criterion('Advice methods contain no business/domain logic',
                    !/entityManager\.|\.save\s*\(|\.delete\s*\(|repository\./m.test(code), 3,
                    'Business/persistence logic inside aspect advice — cross-cutting concerns should only log/audit/time.',
                    'Keep advice thin: log, measure, audit only; delegate actual business work to the intercepted method.');
                break;

            case 'DTO':
                criterion('No JPA/persistence annotations on DTO',
                    !/@Entity\b|@Table\b|@Column\b|@Id\b/m.test(code), 4,
                    'DTO has JPA annotations (@Entity / @Table) — mixes transport and persistence concerns.',
                    'Remove @Entity from DTO; create a separate @Entity class for persistence.');

                criterion('Immutable or record-based DTO',
                    /\brecord\s+\w+/m.test(code) || /@Value\b/m.test(code) ||
                    /private\s+final\s+\w+\s+\w+/m.test(code), 2,
                    'DTO fields are mutable — consider Java records (Java 16+) or final fields for safety.',
                    'public record UserDto(String name, String email) {}  // Java 16+ immutable record');

                criterion('No business methods on DTO (data only)',
                    !/public\s+(?!(?:get|set|equals|hashCode|toString|record)\b)\w+\s+\w+\s*\(/m.test(code), 3,
                    'Business methods detected on DTO — DTOs should only carry data, not execute logic.',
                    'Remove business methods from DTO; put them in the Service layer.');
                break;

            case 'Strategy':
                criterion('Strategy interface defined',
                    /\binterface\s+\w*Strategy\b/m.test(code), 3,
                    'No Strategy interface — concrete strategies cannot be used interchangeably.',
                    'public interface PricingStrategy { BigDecimal calculate(Order order); }');

                criterion('Context depends on Strategy interface (not concrete)',
                    /private\s+(?:final\s+)?\w*Strategy\s+\w+/m.test(code), 3,
                    'Context holds a concrete strategy type — defeats the purpose of the pattern.',
                    'private PricingStrategy strategy;  // interface, not DiscountPricingStrategy');

                criterion('Strategy injectable or settable at runtime',
                    /(?:set|inject|assign)\w*Strategy|Strategy\s+\w+\s*\)/m.test(code), 2,
                    'Strategy cannot be swapped at runtime — hard-coded in constructor without setter.',
                    'public void setStrategy(PricingStrategy s) { this.strategy = s; }');
                break;

            case 'Observer':
                criterion('Listeners registered via method (not hard-coded)',
                    /addListener|subscribe|register\w*Listener|@EventListener/m.test(code), 3,
                    'Listeners appear hard-coded — Subject holds concrete Observer instances.',
                    'void addListener(OrderListener l) { listeners.add(l); }  // or use Spring @EventListener');

                criterion('Subject notifies via interface method',
                    /(?:notify|publish|dispatch|fire)\w*\s*\(/m.test(code), 2,
                    'No notification method — Subject does not propagate events to observers.',
                    'listeners.forEach(l -> l.onOrderCreated(event));');
                break;

            case 'Chain of Responsibility':
                criterion('Handler holds reference to next handler',
                    /(?:private|protected)\s+\w*Handler\s+next/m.test(code), 3,
                    'No "next" handler reference — chain cannot forward unhandled requests.',
                    'private Handler next; public void setNext(Handler h) { this.next = h; }');

                criterion('Passes request to next if unhandled',
                    /next\s*(?:!=\s*null\s*&&\s*)?\.handle|next\.process|next\.execute/m.test(code), 3,
                    'Handler does not pass to next — chain stops after first handler regardless of match.',
                    'if (next != null) next.handle(request);');
                break;

            default:
                return { criteria: [], violations: [], suggestions: [], score: 0, maxScore: 0, percentage: 100, grade: 'A', gradeColor: '#8b949e' };
        }

        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;
        const grade      = percentage >= 80 ? 'A' : percentage >= 65 ? 'B' : percentage >= 50 ? 'C' : 'F';
        const gradeColor = percentage >= 80 ? '#3fb950' : percentage >= 65 ? '#d29922' : percentage >= 50 ? '#f0883e' : '#f85149';

        return { criteria, violations, suggestions, score, maxScore, percentage, grade, gradeColor };
    }

    /* =========================================================
       2. PATCH detectDesignPatterns — add .adherence to each result
       ========================================================= */

    function patchDetectDesignPatterns() {
        const orig = window.detectDesignPatterns;
        if (!orig) return;
        window.detectDesignPatterns = function (code, filename) {
            const patterns = orig(code, filename);
            return patterns.map(p => ({
                ...p,
                adherence: checkPatternAdherence(code, p.name)
            }));
        };
    }

    /* =========================================================
       3. INJECT ADHERENCE TAB INTO RESULTS PANEL
       ========================================================= */

    function injectAdherenceTab() {
        const tabBar = document.querySelector('.result-tabs');
        if (!tabBar || tabBar.querySelector('[data-tab="adherence"]')) return;

        const btn = document.createElement('button');
        btn.className = 'result-tab';
        btn.dataset.tab = 'adherence';
        btn.innerHTML = '📐 Adherence';
        btn.addEventListener('click', () => {
            if (typeof window.showResultTab === 'function') window.showResultTab('adherence');
            else {
                document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.result-tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById('tab-adherence');
                if (panel) panel.classList.add('active');
            }
        });
        tabBar.appendChild(btn);

        const resultsContent = document.querySelector('.results-content');
        if (!resultsContent) return;

        const panel = document.createElement('div');
        panel.className = 'result-tab-panel';
        panel.id = 'tab-adherence';
        panel.innerHTML = `
            <div id="adherence-empty-state" style="text-align:center;padding:4rem 2rem">
                <div style="font-size:4rem;margin-bottom:1rem;opacity:0.3">📐</div>
                <h3 style="font-size:1.25rem;margin-bottom:0.5rem;color:var(--text-secondary)">Select a file to see adherence</h3>
                <p style="color:var(--text-muted);font-size:0.9rem">Pattern adherence scores will appear after analysis.</p>
            </div>
            <div id="adherence-report" style="display:none"></div>
        `;
        resultsContent.appendChild(panel);
    }

    /* ─── Render adherence panel for a file ─────────────────── */

    function renderAdherencePanel(patterns) {
        const empty  = document.getElementById('adherence-empty-state');
        const report = document.getElementById('adherence-report');
        if (!empty || !report) return;

        const scored = (patterns || []).filter(p => p.adherence && p.adherence.maxScore > 0);

        if (scored.length === 0) {
            empty.style.display = '';
            report.style.display = 'none';
            empty.querySelector('h3').textContent = patterns && patterns.length
                ? 'No adherence criteria for detected patterns'
                : 'No design patterns detected';
            return;
        }

        empty.style.display = 'none';
        report.style.display = '';

        const avgPct  = Math.round(scored.reduce((s, p) => s + p.adherence.percentage, 0) / scored.length);
        const failing = scored.filter(p => p.adherence.percentage < 65);
        const passing = scored.filter(p => p.adherence.percentage >= 80);
        const avgColor = avgPct >= 80 ? '#3fb950' : avgPct >= 65 ? '#d29922' : avgPct >= 50 ? '#f0883e' : '#f85149';

        report.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.5rem">
                <div class="metric-card" style="border-left:3px solid ${avgColor}">
                    <div class="metric-value" style="color:${avgColor}">${avgPct}%</div>
                    <div class="metric-label">Avg Adherence</div>
                </div>
                <div class="metric-card success">
                    <div class="metric-value" style="color:#3fb950">${passing.length}</div>
                    <div class="metric-label">Passing (≥80%)</div>
                </div>
                <div class="metric-card error">
                    <div class="metric-value" style="color:#f85149">${failing.length}</div>
                    <div class="metric-label">Failing (&lt;65%)</div>
                </div>
            </div>
            <div class="section-title">📐 Pattern-by-Pattern Adherence</div>
            ${scored.map(renderAdherenceCard).join('')}
        `;
    }

    function renderAdherenceCard(p) {
        const adh = p.adherence;
        const trackColor = adh.percentage >= 80 ? '#3fb950'
                         : adh.percentage >= 65  ? '#d29922'
                         : adh.percentage >= 50  ? '#f0883e' : '#f85149';

        const criteriaRows = adh.criteria.map(c => `
            <div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;
                        border-bottom:1px solid rgba(48,54,61,0.5)">
                <span style="flex-shrink:0">${c.passed ? '✅' : '❌'}</span>
                <span style="font-size:0.78rem;color:${c.passed ? 'var(--text-primary)' : '#f85149'}">${c.label}</span>
                <span style="margin-left:auto;font-size:0.67rem;color:var(--text-muted)">${c.weight}pt</span>
            </div>`).join('');

        const violBox = adh.violations.length ? `
            <div style="margin-top:0.75rem;background:#1a0a0a;border:1px solid rgba(248,81,73,0.3);
                        border-radius:6px;padding:0.75rem">
                <div style="font-size:0.72rem;font-weight:700;color:#f85149;margin-bottom:0.5rem">⚠ VIOLATIONS</div>
                ${adh.violations.map(v => `
                    <div style="font-size:0.77rem;color:var(--text-secondary);padding:0.25rem 0 0.25rem 0.6rem;
                                border-left:2px solid #f85149;margin-bottom:0.3rem;line-height:1.5">${v}</div>
                `).join('')}
            </div>` : '';

        const fixBox = adh.suggestions.length ? `
            <div style="margin-top:0.6rem;background:#0a1a0a;border:1px solid rgba(63,185,80,0.3);
                        border-radius:6px;padding:0.75rem">
                <div style="font-size:0.72rem;font-weight:700;color:#3fb950;margin-bottom:0.5rem">💡 FIX SUGGESTIONS</div>
                ${adh.suggestions.map(s => `
                    <div style="font-size:0.74rem;color:var(--text-secondary);padding:0.25rem 0 0.25rem 0.6rem;
                                border-left:2px solid #3fb950;margin-bottom:0.3rem;
                                font-family:'Fira Code',monospace;line-height:1.6">${s}</div>
                `).join('')}
            </div>` : '';

        return `
            <div class="pattern-card" style="flex-direction:column;gap:0;margin-bottom:1rem">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
                    <span style="font-size:1.4rem">${p.icon}</span>
                    <div style="flex:1">
                        <div style="font-weight:600;font-size:0.95rem;display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap">
                            ${p.name}
                            <span class="pattern-category-badge" style="background:rgba(88,166,255,0.15);color:#58a6ff;
                                  border:1px solid rgba(88,166,255,0.35)">${p.category}</span>
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem">${adh.score}/${adh.maxScore} criteria met</div>
                    </div>
                    <div style="text-align:center;min-width:48px">
                        <div style="font-size:1.6rem;font-weight:800;color:${adh.gradeColor};line-height:1">${adh.grade}</div>
                        <div style="font-size:0.65rem;color:var(--text-muted)">${adh.percentage}%</div>
                    </div>
                </div>
                <div style="height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden;margin-bottom:0.875rem">
                    <div style="height:100%;width:${adh.percentage}%;background:${trackColor};
                                border-radius:3px;transition:width 0.4s ease"></div>
                </div>
                <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;padding:0.5rem 0.75rem">
                    ${criteriaRows}
                </div>
                ${violBox}${fixBox}
            </div>`;
    }

    /* =========================================================
       4. HOOK INTO FILE SELECTION to refresh adherence panel
       ========================================================= */

    function hookFileSelection() {
        document.addEventListener('click', (e) => {
            const item = e.target.closest('.file-item');
            if (!item) return;
            const idx = parseInt(item.dataset.idx ?? item.dataset.index ?? '-1', 10);
            setTimeout(() => {
                const files = window.analysedFiles || window.analyzedFiles || window._files || [];
                if (files[idx]) renderAdherencePanel(files[idx].patterns || []);
            }, 80);
        });

        // Also hook result-tab clicks so adherence panel updates if already active
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-tab="adherence"]')) {
                const files = window.analysedFiles || window.analyzedFiles || window._files || [];
                const sel = document.querySelector('.file-item.selected');
                if (sel) {
                    const idx = parseInt(sel.dataset.idx ?? sel.dataset.index ?? '-1', 10);
                    if (files[idx]) renderAdherencePanel(files[idx].patterns || []);
                }
            }
        });
    }

    /* =========================================================
       5. SAMPLE FAILING JAVA DATA
       ========================================================= */

    const SAMPLE_FILES = {
        'BadSingleton.java': `// DELIBERATELY BAD — will FAIL Singleton adherence checks
// Violations: public constructor, no volatile, public instance field, no thread safety

public class BadSingleton {

    // VIOLATION 1: public field — anyone can overwrite the instance
    public static BadSingleton instance;

    // VIOLATION 2: public constructor — anyone can create new instances
    public BadSingleton() {
        System.out.println("Creating BadSingleton - this breaks the pattern!");
    }

    // VIOLATION 3: no synchronization — race condition on first call
    // VIOLATION 4: no volatile on instance field — broken under JMM
    public static BadSingleton getInstance() {
        if (instance == null) {
            instance = new BadSingleton(); // Not thread-safe!
        }
        return instance;
    }

    public void doWork() {
        System.out.println("Working... but I might not be the only instance!");
    }
}`,

        'BadRepository.java': `import org.springframework.stereotype.Repository;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

// DELIBERATELY BAD — will FAIL Repository adherence checks
// Violations: business logic inside repo, raw EntityManager, @Transactional in repo, class not interface

@Repository
public class UserRepository {   // VIOLATION: should be an interface

    @PersistenceContext
    private EntityManager em;

    // VIOLATION: business logic (rules + decisions) inside repository layer
    public User findAndValidateUser(Long id) {
        User user = em.find(User.class, id);
        if (user == null) {
            throw new RuntimeException("User not found");  // business rule in repo!
        }
        // VIOLATION: another business rule in repo
        if (!user.isActive()) {
            throw new RuntimeException("Account disabled");
        }
        // VIOLATION: write logic inside a "find" method
        if (user.getLoginAttempts() > 5) {
            user.setLocked(true);
            em.merge(user);
        }
        return user;
    }

    // VIOLATION: SQL injection risk + raw query instead of Spring Data
    public List<User> findByEmailDomain(String domain) {
        return em.createQuery(
            "SELECT u FROM User u WHERE u.email LIKE '%" + domain + "'",
            User.class).getResultList();
    }

    // VIOLATION: @Transactional belongs in Service layer, not Repository
    @Transactional
    public void processUserBatch(List<Long> ids) {
        for (Long id : ids) {
            User u = em.find(User.class, id);
            u.setProcessed(true);
        }
    }
}`,

        'BadController.java': `import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Date;

// DELIBERATELY BAD — will FAIL MVC adherence checks
// Violations: business logic in controller, repo injected directly, no @Valid, returns @Entity

@RestController
@RequestMapping("/api/users")
public class UserController {

    // VIOLATION: Repository injected directly — must use Service layer
    @Autowired
    private UserRepository userRepository;

    // VIOLATION: Business logic + validation in controller
    // VIOLATION: Request body has no @Valid
    // VIOLATION: Returns domain @Entity (not a DTO)
    @PostMapping
    public User createUser(@RequestBody User user) {
        if (user.getName() == null || user.getName().isEmpty()) {
            throw new RuntimeException("Name is required");
        }
        if (user.getEmail() == null || !user.getEmail().contains("@")) {
            throw new RuntimeException("Invalid email format");
        }

        // VIOLATION: query logic + business rule in controller
        List<User> existing = userRepository.findByEmail(user.getEmail());
        if (!existing.isEmpty()) {
            throw new RuntimeException("Email already registered");
        }

        user.setStatus("PENDING");
        user.setCreatedAt(new Date());
        if (user.getRole() == null) user.setRole("USER");

        return userRepository.save(user);  // returns @Entity — leaks internals
    }

    // VIOLATION: Complex stream/filter processing belongs in Service
    @GetMapping("/premium-active")
    public List<User> getPremiumActiveUsers() {
        return userRepository.findAll().stream()
            .filter(u -> u.getSubscription() != null)
            .filter(u -> u.getSubscription().isPremium())
            .filter(User::isActive)
            .collect(Collectors.toList());
    }
}`,

        'BadBuilder.java': `// DELIBERATELY BAD — will FAIL Builder adherence checks
// Violations: non-static Builder, no fluent chaining, no validation in build(), public constructor, mutable fields

public class UserProfile {

    // VIOLATION: fields are not final — product is mutable after construction
    private String name;
    private String email;
    private int age;

    // VIOLATION: public constructor defeats the Builder pattern
    public UserProfile() { }

    public UserProfile(String name, String email, int age) {
        this.name = name;
        this.email = email;
        this.age = age;
    }

    // VIOLATION: Builder is NOT static — requires outer UserProfile instance to create
    public class Builder {
        private String name;
        private String email;
        private int age;

        // VIOLATION: returns void, not Builder — callers cannot chain methods
        public void name(String name) {
            this.name = name;  // should: return this;
        }

        public void email(String email) {
            this.email = email;  // should: return this;
        }

        public void age(int age) {
            this.age = age;  // should: return this;
        }

        // VIOLATION: no validation — null name/email silently accepted
        public UserProfile build() {
            return new UserProfile(name, email, age);  // no Objects.requireNonNull
        }
    }
}`,

        'BadService.java': `import org.springframework.beans.factory.annotation.Autowired;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;

// DELIBERATELY BAD — will FAIL Service Layer adherence checks
// Violations: missing @Service, direct JDBC/EntityManager, no @Transactional, new-ing beans, field injection

// VIOLATION: No @Service annotation — Spring cannot manage this bean
public class OrderService {

    // VIOLATION: Field injection — hard to test without Spring context
    @Autowired
    private ProductRepository productRepository;

    // VIOLATION: Direct EntityManager in Service layer
    @PersistenceContext
    private EntityManager entityManager;

    // VIOLATION: No @Transactional despite modifying data
    public void processOrder(Long orderId) {

        // VIOLATION: Direct JDBC connection in Service — bypasses all ORM/repo abstraction
        try {
            Connection conn = DriverManager.getConnection(
                "jdbc:mysql://localhost:3306/shopdb", "root", "p@ssw0rd");
            PreparedStatement ps = conn.prepareStatement(
                "UPDATE orders SET status='PROCESSED' WHERE id=?");
            ps.setLong(1, orderId);
            ps.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();  // swallowing exceptions — silent failure
        }

        // VIOLATION: Creating a Spring-managed bean with 'new' — bypasses IoC
        UserRepository userRepo = new UserRepository();

        // VIOLATION: Direct EntityManager in Service
        Order order = entityManager.find(Order.class, orderId);
        if (order != null) {
            order.setStatus("PROCESSED");
            entityManager.merge(order);
        }
    }
}`
    };

    /* ─── Inject "Load Sample" button ─── */

    function injectSampleButton() {
        const actions = document.querySelector('.header-actions');
        if (!actions || actions.querySelector('#adhPatchSampleBtn')) return;

        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.id = 'adhPatchSampleBtn';
        btn.innerHTML = '🧪 Load Sample (Failing)';
        btn.title = 'Load 5 deliberately bad Java files to test pattern adherence checking';
        btn.addEventListener('click', loadSampleData);
        actions.prepend(btn);
    }

    function loadSampleData() {
        const fakeFiles = Object.entries(SAMPLE_FILES).map(([name, code]) => ({
            name,
            code,
            content: code,
            size: code.length
        }));

        // Try common global hooks the original tool may expose
        if (typeof window.analyzeFiles === 'function')        { window.analyzeFiles(fakeFiles); return; }
        if (typeof window.processFiles === 'function')        { window.processFiles(fakeFiles); return; }
        if (typeof window.handleFilesArray === 'function')    { window.handleFilesArray(fakeFiles); return; }

        // Fallback: load first sample into paste tab
        const textarea  = document.querySelector('.code-textarea');
        const nameInput = document.querySelector('.paste-input');
        if (textarea && nameInput) {
            nameInput.value  = 'BadSingleton.java';
            textarea.value   = SAMPLE_FILES['BadSingleton.java'];
            // Activate paste tab
            document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            const pasteTab = document.querySelector('.upload-tab:first-child');
            const pastePanel = document.querySelector('.tab-panel:first-child');
            if (pasteTab)  pasteTab.classList.add('active');
            if (pastePanel) pastePanel.classList.add('active');
            toast('📋 Sample loaded in paste tab — click Analyse Code, then open the 📐 Adherence tab.', '🧪');
        } else {
            toast('Could not inject sample data. Paste BadSingleton.java content manually.', '⚠️');
        }
    }

    function toast(msg, icon = 'ℹ️') {
        let t = document.querySelector('.toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'toast';
            t.innerHTML = '<div class="toast-message"></div>';
            document.body.appendChild(t);
        }
        const m = t.querySelector('.toast-message');
        if (m) m.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 5000);
    }

    /* =========================================================
       6. INJECT EXTRA CSS
       ========================================================= */

    function injectCSS() {
        const s = document.createElement('style');
        s.textContent = `
            #tab-adherence { display: none; }
            #tab-adherence.active { display: block; }
            .metric-card.success { border-left: 3px solid #3fb950; }
            .metric-card.warning { border-left: 3px solid #d29922; }
            .metric-card.error   { border-left: 3px solid #f85149; }
        `;
        document.head.appendChild(s);
    }

    /* =========================================================
       7. INIT
       ========================================================= */

    function init() {
        injectCSS();
        patchDetectDesignPatterns();
        injectAdherenceTab();
        injectSampleButton();
        hookFileSelection();
        console.info('[Adherence Patch] ✅ Loaded — Design Pattern Adherence Checker active.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
