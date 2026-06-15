/**
 * Full Java/Spring Design Pattern Compliance Scanner
 * Patch for code_review_enterprise release.html
 *
 * Add before </body>:
 *   <script src="code-review-full-compliance.js"></script>
 *
 * Coverage:
 *   CREATIONAL  : Singleton, Factory Method, Abstract Factory, Builder, Prototype, Object Pool
 *   STRUCTURAL  : Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy
 *   BEHAVIORAL  : Chain of Responsibility, Command, Iterator, Mediator, Memento,
 *                 Observer, State, Strategy, Template Method, Visitor
 *   ENTERPRISE  : Repository, Service Layer, DTO, MVC, CQRS, Event Sourcing, Saga,
 *                 Unit of Work, Domain Events, Specification
 *   CLOUD       : Circuit Breaker, Bulkhead, Retry, Rate Limiter, API Gateway,
 *                 Service Discovery, Config Server, Health Check, Distributed Tracing, Sidecar
 *   SPRING      : Dependency Injection, AOP, Template Method (Spring), Event-Driven,
 *                 Reactive (WebFlux), Spring Security, Spring Data
 *   ANTI-PATTERNS: God Class, Anemic Domain Model, Service Locator, Magic Numbers,
 *                  Singleton Abuse, Big Controller, Transaction Script
 */

(function () {
    'use strict';

    /* =========================================================
       SECTION A — PATTERN LIBRARY (detect + adherence criteria)
       ========================================================= */

    const PATTERN_LIBRARY = {

        /* ─────────────────── CREATIONAL ─────────────────── */

        Singleton: {
            family: 'Creational', icon: '🔒',
            detect: c => /private\s+static\s+(?:volatile\s+)?\w+\s+\w*[Ii]nstance/m.test(c) &&
                         /getInstance\s*\(/m.test(c),
            criteria: [
                { label: 'Private constructor',             w: 3, test: c => /private\s+\w+\s*\(\s*\)/m.test(c) },
                { label: 'Thread-safe (volatile/sync/enum)',w: 3, test: c => /volatile\s+|synchronized\s*\(|\benum\s+/.test(c) },
                { label: 'No public constructor',           w: 3, test: c => !/public\s+\w+\s*\(\s*\)/m.test(c) },
                { label: 'Static getInstance() method',     w: 2, test: c => /static[^(]+getInstance\s*\(/m.test(c) },
                { label: 'Instance field is private',       w: 2, test: c => !/public\s+static\s+\w+\s+\w*[Ii]nstance/m.test(c) },
            ],
            fixes: {
                'Private constructor':              'Add: private YourClass() {}',
                'Thread-safe (volatile/sync/enum)': 'Use: private static volatile YourClass instance; with double-checked locking',
                'No public constructor':            'Remove public constructors',
                'Static getInstance() method':      'Add: public static YourClass getInstance() { ... }',
                'Instance field is private':        'Change to: private static volatile YourClass instance;',
            }
        },

        'Factory Method': {
            family: 'Creational', icon: '🏭',
            detect: c => /class\s+\w*Factory\b/m.test(c) || /\b(create|make|produce|build)\w*\s*\([^)]*\)\s*\{/m.test(c),
            criteria: [
                { label: 'Returns interface/abstract type',  w: 4, test: c => /(?:interface|abstract\s+class)\s+\w+/m.test(c) },
                { label: 'No instanceof checks',             w: 3, test: c => !/\binstanceof\s+\w+/m.test(c) },
                { label: 'Dedicated Factory class',          w: 2, test: c => /class\s+\w*Factory\b/m.test(c) },
                { label: 'Extensible via registry/Map',      w: 2, test: c => /Map<|\.put\s*\(|register\w*\s*\(/.test(c) },
            ],
            fixes: {
                'Returns interface/abstract type': 'Define product interface: public interface Product { void execute(); }',
                'No instanceof checks':            'Replace instanceof chain with Map<String, Supplier<Product>> registry',
                'Dedicated Factory class':         'Extract: public class ProductFactory { public Product create(String type) {...} }',
                'Extensible via registry/Map':     'Use registry: Map<String, Supplier<Product>> r = new HashMap<>();',
            }
        },

        'Abstract Factory': {
            family: 'Creational', icon: '🏗️',
            detect: c => /interface\s+\w*Factory\b/m.test(c) &&
                         (c.match(/\bcreate\w+\s*\(/gm) || []).length >= 2,
            criteria: [
                { label: 'Factory is an interface/abstract',    w: 4, test: c => /(?:interface|abstract\s+class)\s+\w*Factory/m.test(c) },
                { label: 'Creates related family of objects',   w: 3, test: c => (c.match(/\bcreate\w+\s*\(/gm) || []).length >= 2 },
                { label: 'Concrete factories implement interface',w: 3, test: c => /implements\s+\w*Factory/m.test(c) },
                { label: 'Products are abstract/interface types',w: 2, test: c => /(?:interface|abstract\s+class)\s+\w+Product/m.test(c) || /interface\s+\w+/m.test(c) },
            ],
            fixes: {
                'Factory is an interface/abstract':      'Define: public interface UIFactory { Button createButton(); Dialog createDialog(); }',
                'Creates related family of objects':     'Add at least 2 create*() methods for related product types',
                'Concrete factories implement interface':'public class WindowsFactory implements UIFactory { ... }',
                'Products are abstract/interface types': 'Define product interfaces: interface Button { void render(); }',
            }
        },

        Builder: {
            family: 'Creational', icon: '🔧',
            detect: c => /class\s+\w*Builder\b/m.test(c) || /\.builder\(\)/m.test(c) || /@Builder\b/m.test(c),
            criteria: [
                { label: 'Static inner Builder class',          w: 3, test: c => /static\s+(?:final\s+)?class\s+\w*Builder/m.test(c) || /@Builder\b/m.test(c) },
                { label: 'Fluent method chaining (return this)',w: 3, test: c => /return\s+this\s*;/m.test(c) || /@Builder\b/m.test(c) },
                { label: 'build() method present',              w: 2, test: c => /public\s+\w+\s+build\s*\(\s*\)/m.test(c) || /@Builder\b/m.test(c) },
                { label: 'Validates required fields in build()',w: 2, test: c => /Objects\.requireNonNull|requireNonNull|@NonNull|if.*==\s*null.*throw/.test(c) },
                { label: 'Immutable product (final fields)',    w: 2, test: c => /private\s+final\s+\w+\s+\w+/m.test(c) },
            ],
            fixes: {
                'Static inner Builder class':           'public static class Builder { ... }  // must be static',
                'Fluent method chaining (return this)': 'public Builder name(String n) { this.name=n; return this; }',
                'build() method present':               'public YourClass build() { validate(); return new YourClass(this); }',
                'Validates required fields in build()': 'Objects.requireNonNull(name, "name required");  in build()',
                'Immutable product (final fields)':     'private final String name;  // all product fields final',
            }
        },

        Prototype: {
            family: 'Creational', icon: '📋',
            detect: c => /implements\s+Cloneable/m.test(c) && /\bclone\s*\(\s*\)/m.test(c),
            criteria: [
                { label: 'Implements Cloneable',        w: 3, test: c => /implements\s+Cloneable/m.test(c) },
                { label: 'Overrides clone() method',    w: 3, test: c => /public\s+\w+\s+clone\s*\(\s*\)/m.test(c) },
                { label: 'Performs deep copy',          w: 3, test: c => /super\.clone|new\s+\w+\(this\)|copy/.test(c) },
                { label: 'Handles CloneNotSupported',   w: 2, test: c => /CloneNotSupportedException|try\s*\{[^}]+clone/.test(c) },
            ],
            fixes: {
                'Implements Cloneable':      'implements Cloneable on your class',
                'Overrides clone() method':  '@Override public YourClass clone() throws CloneNotSupportedException { return (YourClass) super.clone(); }',
                'Performs deep copy':        'Manually copy mutable fields: result.list = new ArrayList<>(this.list);',
                'Handles CloneNotSupported': 'try { return (T) super.clone(); } catch (CloneNotSupportedException e) { throw new RuntimeException(e); }',
            }
        },

        'Object Pool': {
            family: 'Creational', icon: '🏊',
            detect: c => /pool|Pool/.test(c) && /borrow|acquire|release|checkout/.test(c),
            criteria: [
                { label: 'Pool manages object lifecycle',    w: 3, test: c => /pool\w*\s*=\s*new\s+|BlockingQueue|ArrayDeque|LinkedList/.test(c) },
                { label: 'acquire/borrow method exists',     w: 3, test: c => /acquire|borrow|checkout|getObject/.test(c) },
                { label: 'release/return method exists',     w: 3, test: c => /release|return\w*Object|returnToPool|checkin/.test(c) },
                { label: 'Thread-safe pool implementation',  w: 2, test: c => /synchronized|BlockingQueue|Semaphore|AtomicInteger/.test(c) },
                { label: 'Handles pool exhaustion',          w: 2, test: c => /wait\s*\(|timeout|PoolExhausted|maxWait/.test(c) },
            ],
            fixes: {
                'Pool manages object lifecycle':   'Use BlockingQueue<T> pool = new ArrayBlockingQueue<>(maxSize);',
                'acquire/borrow method exists':    'public T acquire() { return pool.poll(); }',
                'release/return method exists':    'public void release(T obj) { pool.offer(obj); }',
                'Thread-safe pool implementation': 'Use BlockingQueue or synchronized blocks for thread safety',
                'Handles pool exhaustion':         'Add timeout: pool.poll(timeout, TimeUnit.MILLISECONDS)',
            }
        },

        /* ─────────────────── STRUCTURAL ─────────────────── */

        Adapter: {
            family: 'Structural', icon: '🔌',
            detect: c => /class\s+\w+Adapter\b/m.test(c) || (/(implements\s+\w+)/m.test(c) && /private\s+\w+\s+adaptee/m.test(c)),
            criteria: [
                { label: 'Uses composition (not extends)',   w: 4, test: c => /private\s+(?:final\s+)?\w+\s+adaptee/m.test(c) },
                { label: 'Implements target interface',      w: 3, test: c => /implements\s+\w+/m.test(c) },
                { label: 'No business logic (thin adapter)', w: 3, test: c => !/(?:if|for|while)\s*\(/.test(c) },
                { label: 'Delegates to adaptee',            w: 3, test: c => /adaptee\.|wrapped\.|delegate\./.test(c) },
            ],
            fixes: {
                'Uses composition (not extends)':   'private final LegacySystem adaptee;  // object adapter',
                'Implements target interface':       'public class LegacyAdapter implements ModernInterface { ... }',
                'No business logic (thin adapter)': 'Keep adapter thin — only translate calls, no business logic',
                'Delegates to adaptee':             'return adaptee.oldMethod(translateParam(p));',
            }
        },

        Bridge: {
            family: 'Structural', icon: '🌉',
            detect: c => /private\s+\w+Impl\s+\w+|private\s+\w+Implementation\s+\w+/m.test(c) ||
                         (/abstract\s+class\s+\w+/m.test(c) && /interface\s+\w+Impl\b/m.test(c)),
            criteria: [
                { label: 'Abstraction and implementation separated', w: 4, test: c => /abstract\s+class/.test(c) && /interface\s+\w+/.test(c) },
                { label: 'Implementation injected into abstraction', w: 3, test: c => /private\s+\w+\s+impl|private\s+\w+Implementation/.test(c) },
                { label: 'Abstraction delegates to implementation',  w: 3, test: c => /impl\.\w+\s*\(|implementation\.\w+\s*\(/.test(c) },
            ],
            fixes: {
                'Abstraction and implementation separated': 'Define abstract class Shape and interface DrawingAPI separately',
                'Implementation injected into abstraction': 'Shape(DrawingAPI api) { this.api = api; }',
                'Abstraction delegates to implementation':  'public void draw() { api.drawCircle(x, y, radius); }',
            }
        },

        Composite: {
            family: 'Structural', icon: '🌲',
            detect: c => /List<\w+>\s+\w+|List<\w+>.*=.*new\s+ArrayList/m.test(c) &&
                         /add\w*\s*\(|remove\w*\s*\(/.test(c),
            criteria: [
                { label: 'Component interface defined',      w: 4, test: c => /interface\s+\w+Component|abstract\s+class\s+\w+/.test(c) },
                { label: 'Leaf and Composite same interface',w: 3, test: c => /implements\s+\w+Component|extends\s+\w+/.test(c) },
                { label: 'Composite holds List of children', w: 3, test: c => /List<\w+>\s+children|List<\w+>\s+components/.test(c) },
                { label: 'add()/remove() on composite',     w: 2, test: c => /void\s+add\s*\(|void\s+remove\s*\(/.test(c) },
            ],
            fixes: {
                'Component interface defined':       'public interface Component { void operation(); }',
                'Leaf and Composite same interface': 'Both Leaf and Composite implement Component',
                'Composite holds List of children':  'private List<Component> children = new ArrayList<>();',
                'add()/remove() on composite':       'public void add(Component c) { children.add(c); }',
            }
        },

        Decorator: {
            family: 'Structural', icon: '🎁',
            detect: c => /class\s+\w+Decorator\b/m.test(c) ||
                         (/implements\s+\w+/m.test(c) && /private\s+(?:final\s+)?\w+\s+\w+;/m.test(c) && /this\.\w+\s*=\s*\w+;/m.test(c)),
            criteria: [
                { label: 'Wraps same interface it implements', w: 4, test: c => /implements\s+\w+/m.test(c) && /private\s+(?:final\s+)?\w+\s+\w+;/m.test(c) },
                { label: 'Delegates to wrapped component',     w: 3, test: c => /component\.|wrapped\.|delegate\.|super\./.test(c) },
                { label: 'Wrapped object injected via constructor', w: 2, test: c => /\w+\s+\w+\)\s*\{[\s\n]*this\.\w+\s*=\s*\w+/m.test(c) },
            ],
            fixes: {
                'Wraps same interface it implements':       'private final Component component;  implements Component',
                'Delegates to wrapped component':           'component.operation();  // always delegate',
                'Wrapped object injected via constructor':  'public LoggingDecorator(Component c) { this.component = c; }',
            }
        },

        Facade: {
            family: 'Structural', icon: '🏛️',
            detect: c => /class\s+\w*Facade\b/m.test(c),
            criteria: [
                { label: 'Facade class naming convention',   w: 3, test: c => /class\s+\w*Facade\b/m.test(c) },
                { label: 'Subsystems are private',           w: 3, test: c => /private\s+(?:final\s+)?\w+(?:Service|Manager|Client|System)\s+\w+/m.test(c) },
                { label: 'Exposes simplified public methods',w: 2, test: c => /public\s+(?:void|[\w<>]+)\s+\w+\s*\(/m.test(c) },
                { label: 'No complex logic exposed',         w: 2, test: c => !/public\s+(?:void|[\w<>]+)\s+\w+[^{]+\{[^}]{200,}/ms.test(c) },
            ],
            fixes: {
                'Facade class naming convention':    'Rename to: public class OrderFacade { ... }',
                'Subsystems are private':            'private final PaymentService payment; private final InventoryService inventory;',
                'Exposes simplified public methods': 'public OrderResult placeOrder(Order o) { /* delegates internally */ }',
                'No complex logic exposed':          'Keep facade methods thin; delegate all logic to subsystem services',
            }
        },

        Flyweight: {
            family: 'Structural', icon: '🪶',
            detect: c => /flyweight|Flyweight|intrinsic|extrinsic/.test(c) || (/Map</.test(c) && /factory|Factory/.test(c) && /cache/.test(c)),
            criteria: [
                { label: 'Shared state separated (intrinsic)',   w: 3, test: c => /intrinsic|shared|sharedState/.test(c) },
                { label: 'Context state external (extrinsic)',   w: 3, test: c => /extrinsic|context|Context/.test(c) },
                { label: 'Factory caches flyweight objects',     w: 3, test: c => /Map<|cache|Cache/.test(c) && /factory|Factory/.test(c) },
                { label: 'Immutable shared state',               w: 2, test: c => /private\s+final\s+\w+\s+\w+/m.test(c) },
            ],
            fixes: {
                'Shared state separated (intrinsic)':  'private final String intrinsicState;  // shared, immutable',
                'Context state external (extrinsic)':  'Pass extrinsic state as method parameter: render(int x, int y)',
                'Factory caches flyweight objects':     'Map<String, Flyweight> cache = new HashMap<>();',
                'Immutable shared state':               'All intrinsic state fields must be final',
            }
        },

        Proxy: {
            family: 'Structural', icon: '🛡️',
            detect: c => /@Transactional|@Cacheable|@PreAuthorize|class\s+\w*Proxy\b/m.test(c),
            criteria: [
                { label: 'Proxy implements same interface as subject', w: 3, test: c => /implements\s+\w+/m.test(c) || /@Transactional|@Cacheable|@PreAuthorize/.test(c) },
                { label: 'Controls access to real subject',           w: 3, test: c => /@PreAuthorize|@Secured|checkPermission/.test(c) || /Transactional|Cacheable/.test(c) },
                { label: 'Spring AOP proxy annotations used',         w: 2, test: c => /@Transactional|@Cacheable|@PreAuthorize|@Async/.test(c) },
            ],
            fixes: {
                'Proxy implements same interface as subject': 'Proxy must implement same interface: class ServiceProxy implements Service',
                'Controls access to real subject':            '@PreAuthorize("hasRole(\'ADMIN\')")  or guard methods in proxy',
                'Spring AOP proxy annotations used':          'Use @Transactional/@Cacheable/@PreAuthorize for Spring AOP proxies',
            }
        },

        /* ─────────────────── BEHAVIORAL ─────────────────── */

        'Chain of Responsibility': {
            family: 'Behavioral', icon: '⛓️',
            detect: c => /class\s+\w+Handler\b/m.test(c) || /interface\s+\w*Handler\b/m.test(c),
            criteria: [
                { label: 'Handler interface/abstract defined',    w: 3, test: c => /(?:interface|abstract\s+class)\s+\w*Handler/m.test(c) },
                { label: 'Holds reference to next handler',       w: 3, test: c => /(?:private|protected)\s+\w*Handler\s+next/m.test(c) },
                { label: 'Passes to next if unhandled',           w: 3, test: c => /next\s*!=\s*null|next\.\w+\s*\(/m.test(c) },
                { label: 'setNext() method exists',               w: 2, test: c => /setNext\s*\(|set\w+Handler\s*\(/.test(c) },
            ],
            fixes: {
                'Handler interface/abstract defined':  'abstract class Handler { abstract void handle(Request r); protected Handler next; }',
                'Holds reference to next handler':     'private Handler next;',
                'Passes to next if unhandled':         'if (next != null) next.handle(request);',
                'setNext() method exists':             'public Handler setNext(Handler h) { this.next = h; return h; }',
            }
        },

        Command: {
            family: 'Behavioral', icon: '📨',
            detect: c => /class\s+\w+Command\b/m.test(c) || /interface\s+\w*Command\b/m.test(c),
            criteria: [
                { label: 'Command interface with execute()',  w: 4, test: c => /interface\s+\w*Command|void\s+execute\s*\(\s*\)/m.test(c) },
                { label: 'Encapsulates receiver reference',  w: 3, test: c => /private\s+\w+\s+receiver|private\s+\w+\s+\w+;/m.test(c) },
                { label: 'Supports undo() operation',        w: 2, test: c => /void\s+undo\s*\(\s*\)|void\s+unexecute\s*\(/.test(c) },
                { label: 'Invoker decoupled from receiver',  w: 2, test: c => /private\s+\w*Command\s+command|List<\w*Command>/.test(c) },
            ],
            fixes: {
                'Command interface with execute()':  'public interface Command { void execute(); }',
                'Encapsulates receiver reference':   'private final Light receiver; // in ConcreteCommand',
                'Supports undo() operation':         'public void undo() { receiver.off(); }',
                'Invoker decoupled from receiver':   'private Command command; public void setCommand(Command c) { this.command = c; }',
            }
        },

        Observer: {
            family: 'Behavioral', icon: '👁️',
            detect: c => /@EventListener|implements\s+\w*Listener|implements\s+\w*Observer|ApplicationEventPublisher/.test(c),
            criteria: [
                { label: 'Observer interface defined',          w: 3, test: c => /interface\s+\w*(?:Observer|Listener)|@EventListener/.test(c) },
                { label: 'Observers registered via method',     w: 3, test: c => /addListener|addObserver|subscribe|register\w*Listener|@EventListener/.test(c) },
                { label: 'Subject notifies all observers',      w: 3, test: c => /notify\w*|publish|dispatch|fire\w*|forEach.*onEvent/.test(c) },
                { label: 'Loose coupling (no direct refs)',     w: 2, test: c => !/new\s+\w+(?:Listener|Observer)\b/.test(c) || /@EventListener/.test(c) },
            ],
            fixes: {
                'Observer interface defined':      'public interface OrderListener { void onOrderCreated(Order o); }',
                'Observers registered via method': 'void addListener(OrderListener l) { listeners.add(l); }',
                'Subject notifies all observers':  'listeners.forEach(l -> l.onOrderCreated(order));',
                'Loose coupling (no direct refs)': 'Use Spring ApplicationEventPublisher.publishEvent(event); for zero coupling',
            }
        },

        Strategy: {
            family: 'Behavioral', icon: '🎯',
            detect: c => /interface\s+\w*Strategy|implements\s+\w*Strategy|private\s+\w*Strategy\s+/.test(c),
            criteria: [
                { label: 'Strategy interface defined',        w: 3, test: c => /interface\s+\w*Strategy/m.test(c) },
                { label: 'Context depends on interface',      w: 3, test: c => /private\s+(?:final\s+)?\w*Strategy\s+\w+/m.test(c) },
                { label: 'Strategy swappable at runtime',     w: 2, test: c => /setStrategy|strategy\s*=\s*|\w+Strategy\s+\w+\s*\)/m.test(c) },
                { label: 'Concrete strategies implement interface', w: 2, test: c => /implements\s+\w*Strategy/m.test(c) },
            ],
            fixes: {
                'Strategy interface defined':              'public interface SortStrategy { List<T> sort(List<T> data); }',
                'Context depends on interface':            'private SortStrategy strategy; // not BubbleSortStrategy',
                'Strategy swappable at runtime':           'public void setStrategy(SortStrategy s) { this.strategy = s; }',
                'Concrete strategies implement interface': 'public class QuickSort implements SortStrategy { ... }',
            }
        },

        'Template Method': {
            family: 'Behavioral', icon: '📐',
            detect: c => /abstract\s+class\b/m.test(c) && /protected\s+abstract\b/m.test(c),
            criteria: [
                { label: 'Abstract class with template method',w: 4, test: c => /abstract\s+class/m.test(c) },
                { label: 'Protected abstract hook methods',    w: 4, test: c => /protected\s+abstract\s+\w+\s+\w+\s*\(/m.test(c) },
                { label: 'Template method calls hooks',        w: 3, test: c => /final\s+\w+\s+\w+\s*\(/.test(c) },
                { label: 'Hook methods have default impl',     w: 2, test: c => /protected\s+\w+\s+\w+\s*\(\s*\)\s*\{[\s\n]*\}/m.test(c) },
            ],
            fixes: {
                'Abstract class with template method':  'public abstract class DataProcessor { ... }',
                'Protected abstract hook methods':      'protected abstract void processData(Data d);',
                'Template method calls hooks':          'public final void process() { readData(); processData(data); writeData(); }',
                'Hook methods have default impl':       'protected void validate() { } // optional hook, subclass overrides if needed',
            }
        },

        State: {
            family: 'Behavioral', icon: '🔄',
            detect: c => /class\s+\w+State\b|interface\s+\w*State\b/.test(c),
            criteria: [
                { label: 'State interface defined',          w: 3, test: c => /interface\s+\w*State/m.test(c) },
                { label: 'Context holds state reference',    w: 3, test: c => /private\s+\w*State\s+\w+/m.test(c) },
                { label: 'State transition method on context',w: 2, test: c => /setState\s*\(|changeState\s*\(/.test(c) },
                { label: 'State changes context behaviour',  w: 2, test: c => /state\.\w+\s*\(this\)|state\.handle/.test(c) },
            ],
            fixes: {
                'State interface defined':           'public interface OrderState { void process(Order order); }',
                'Context holds state reference':     'private OrderState currentState;',
                'State transition method on context':'public void setState(OrderState s) { this.currentState = s; }',
                'State changes context behaviour':   'currentState.process(this);  // delegates to current state',
            }
        },

        'Mediator': {
            family: 'Behavioral', icon: '📡',
            detect: c => /class\s+\w*Mediator\b|interface\s+\w*Mediator\b/.test(c),
            criteria: [
                { label: 'Mediator interface defined',        w: 3, test: c => /interface\s+\w*Mediator/m.test(c) },
                { label: 'Colleagues reference mediator only',w: 3, test: c => /private\s+\w*Mediator\s+\w+/.test(c) },
                { label: 'Colleagues communicate via mediator',w: 3, test: c => /mediator\.notify|mediator\.send|mediator\.mediate/.test(c) },
            ],
            fixes: {
                'Mediator interface defined':          'public interface ChatMediator { void send(String msg, User from); }',
                'Colleagues reference mediator only':  'private ChatMediator mediator; // not direct User references',
                'Colleagues communicate via mediator': 'mediator.send(message, this); // never user.receive() directly',
            }
        },

        Memento: {
            family: 'Behavioral', icon: '📸',
            detect: c => /class\s+\w*Memento\b/m.test(c) || /save(?:State|Memento)|restore(?:State|Memento)/.test(c),
            criteria: [
                { label: 'Memento class exists',              w: 3, test: c => /class\s+\w*Memento\b/m.test(c) },
                { label: 'Originator creates/restores mementos',w: 3, test: c => /save\w*\s*\(\s*\)|restore\w*\s*\(/.test(c) },
                { label: 'Memento state is encapsulated',     w: 2, test: c => /private\s+\w+\s+state|private\s+\w+\s+snapshot/.test(c) },
                { label: 'Caretaker manages memento history', w: 2, test: c => /List<\w*Memento>|Stack<\w*Memento>|Deque<\w*Memento>/.test(c) },
            ],
            fixes: {
                'Memento class exists':                'public class EditorMemento { private final String content; }',
                'Originator creates/restores mementos':'public Memento save() { return new Memento(this.state); }',
                'Memento state is encapsulated':       'Memento state should be accessible only to Originator (package-private)',
                'Caretaker manages memento history':   'Deque<EditorMemento> history = new ArrayDeque<>();',
            }
        },

        Visitor: {
            family: 'Behavioral', icon: '🚶',
            detect: c => /interface\s+\w*Visitor\b|void\s+accept\s*\(\s*\w*Visitor/.test(c),
            criteria: [
                { label: 'Visitor interface defined',        w: 4, test: c => /interface\s+\w*Visitor/m.test(c) },
                { label: 'accept() on each element',         w: 3, test: c => /void\s+accept\s*\(\s*\w*Visitor/m.test(c) },
                { label: 'Double dispatch used',             w: 3, test: c => /visitor\.visit\s*\(this\)/m.test(c) },
                { label: 'Concrete visitors implement interface', w: 2, test: c => /implements\s+\w*Visitor/m.test(c) },
            ],
            fixes: {
                'Visitor interface defined':             'public interface ShapeVisitor { void visit(Circle c); void visit(Rectangle r); }',
                'accept() on each element':             'public void accept(ShapeVisitor v) { v.visit(this); }',
                'Double dispatch used':                 'v.visit(this);  // dispatches to correct overloaded visit()',
                'Concrete visitors implement interface': 'public class AreaCalculator implements ShapeVisitor { ... }',
            }
        },

        Iterator: {
            family: 'Behavioral', icon: '🔁',
            detect: c => /implements\s+Iterator<|implements\s+Iterable<|class\s+\w*Iterator\b/.test(c),
            criteria: [
                { label: 'Implements Iterator<T>',     w: 3, test: c => /implements\s+Iterator</.test(c) },
                { label: 'hasNext() implemented',       w: 3, test: c => /public\s+boolean\s+hasNext/.test(c) },
                { label: 'next() implemented',          w: 3, test: c => /public\s+\w+\s+next\s*\(\s*\)/.test(c) },
                { label: 'Collection implements Iterable',w: 2, test: c => /implements\s+Iterable</.test(c) },
            ],
            fixes: {
                'Implements Iterator<T>':        'public class BookIterator implements Iterator<Book> { ... }',
                'hasNext() implemented':         '@Override public boolean hasNext() { return index < items.size(); }',
                'next() implemented':            '@Override public Book next() { return items.get(index++); }',
                'Collection implements Iterable':'@Override public Iterator<Book> iterator() { return new BookIterator(items); }',
            }
        },

        /* ─────────────────── ENTERPRISE ARCHITECTURE ─────────────────── */

        Repository: {
            family: 'Enterprise', icon: '🗄️',
            detect: c => /@Repository|extends\s+(?:Jpa|Crud|Mongo|Page)Repository/.test(c),
            criteria: [
                { label: 'No business logic in repository',   w: 4, test: c => !/if\s*\([^)]{15,}\)\s*\{\s*(?:throw|return\s+(?!em\.|repo\.))/.test(c) },
                { label: 'Extends Spring Data interface',     w: 3, test: c => /extends\s+(?:Jpa|Crud|Mongo|Page|Reactive)Repository/.test(c) },
                { label: 'Defined as interface (not class)',  w: 2, test: c => /\binterface\s+\w*Repository/m.test(c) },
                { label: '@Transactional belongs in Service', w: 2, test: c => !/@Transactional\b/m.test(c) || /extends\s+(?:Jpa|Crud)Repository/.test(c) },
                { label: 'No direct EntityManager/JDBC',     w: 3, test: c => !/EntityManager|JdbcTemplate|DriverManager/.test(c) },
            ],
            fixes: {
                'No business logic in repository':   'Move validation/business rules to Service layer',
                'Extends Spring Data interface':     'public interface UserRepository extends JpaRepository<User, Long> {}',
                'Defined as interface (not class)':  'public interface UserRepository extends JpaRepository<User, Long>',
                '@Transactional belongs in Service': 'Remove @Transactional from repository; add to @Service methods',
                'No direct EntityManager/JDBC':      'Use Spring Data methods; avoid EntityManager in repository',
            }
        },

        'Service Layer': {
            family: 'Enterprise', icon: '⚙️',
            detect: c => /@Service\b/.test(c),
            criteria: [
                { label: '@Service annotation',                  w: 3, test: c => /@Service\b/.test(c) },
                { label: 'No direct DB access',                  w: 4, test: c => !/EntityManager|JdbcTemplate|DriverManager/.test(c) },
                { label: 'Constructor injection (final fields)', w: 3, test: c => /private\s+final\s+\w+Repository|@RequiredArgsConstructor/.test(c) },
                { label: '@Transactional on write methods',      w: 2, test: c => /@Transactional\b/.test(c) },
                { label: 'No "new" for Spring beans',            w: 3, test: c => !/=\s*new\s+\w+(?:Service|Repository|Component)\b/.test(c) },
            ],
            fixes: {
                '@Service annotation':                  '@Service\npublic class UserService { ... }',
                'No direct DB access':                  'Use injected Repository interfaces only',
                'Constructor injection (final fields)': '@RequiredArgsConstructor or explicit constructor with final fields',
                '@Transactional on write methods':      '@Transactional\npublic User create(UserDto dto) { ... }',
                'No "new" for Spring beans':            'Never: new UserRepository(); — let Spring inject',
            }
        },

        DTO: {
            family: 'Enterprise', icon: '📦',
            detect: c => /class\s+\w+(?:DTO|Dto|Request|Response|Payload)\b/.test(c),
            criteria: [
                { label: 'No JPA annotations on DTO',         w: 4, test: c => !/@Entity\b|@Table\b|@Column\b|@Id\b/.test(c) },
                { label: 'Immutable (record / final fields)',  w: 3, test: c => /\brecord\s+\w+|@Value\b/.test(c) || /private\s+final\s+\w+\s+\w+/m.test(c) },
                { label: 'No business methods on DTO',        w: 3, test: c => !/public\s+(?!(?:get|set|equals|hashCode|toString|of|from)\b)\w+\s+\w+\s*\([^)]{5,}\)/.test(c) },
                { label: 'Validation annotations present',    w: 2, test: c => /@NotNull|@NotBlank|@Size|@Email|@Min|@Max/.test(c) },
            ],
            fixes: {
                'No JPA annotations on DTO':          'Remove @Entity/@Table — create separate @Entity for persistence',
                'Immutable (record / final fields)':  'public record UserDto(String name, String email) {}',
                'No business methods on DTO':         'Move business methods to Service layer',
                'Validation annotations present':     '@NotBlank String name; @Email String email;',
            }
        },

        'MVC (Spring MVC)': {
            family: 'Enterprise', icon: '🌐',
            detect: c => /@RestController|@Controller/.test(c),
            criteria: [
                { label: 'No business logic in controller',  w: 4, test: c => !/\b(?:for|while)\s*\(/.test(c) && !/\.stream\(\).*\.filter\(/.test(c) },
                { label: 'No repository in controller',      w: 3, test: c => !/\w+Repository\s+\w+/.test(c) },
                { label: 'Returns DTO/ResponseEntity',       w: 2, test: c => /ResponseEntity|DTO|Dto|Response\b/.test(c) },
                { label: '@Valid on request bodies',         w: 2, test: c => /@Valid\b|@Validated\b/.test(c) },
                { label: 'Injects only Services',           w: 3, test: c => !/\w+Repository\s+\w+/.test(c) },
            ],
            fixes: {
                'No business logic in controller': 'Delegate ALL logic to Service layer; controller only maps HTTP',
                'No repository in controller':     'Inject UserService, not UserRepository',
                'Returns DTO/ResponseEntity':      'return ResponseEntity.ok(userService.find(id).toDto());',
                '@Valid on request bodies':        '@PostMapping public ResponseEntity<?> create(@Valid @RequestBody UserDto dto)',
                'Injects only Services':           'private final UserService userService;  // never inject repository',
            }
        },

        CQRS: {
            family: 'Enterprise', icon: '⚡',
            detect: c => /Command|Query/.test(c) && /CommandHandler|QueryHandler|commandBus|queryBus/.test(c),
            criteria: [
                { label: 'Commands and Queries separated',   w: 4, test: c => /\w+Command\b|\w+Query\b/.test(c) },
                { label: 'Command handlers defined',         w: 3, test: c => /CommandHandler|handleCommand|@CommandHandler/.test(c) },
                { label: 'Query handlers defined',           w: 3, test: c => /QueryHandler|handleQuery|@QueryHandler/.test(c) },
                { label: 'Read/write models separated',      w: 3, test: c => /ReadModel|WriteModel|Projection|projection/.test(c) },
            ],
            fixes: {
                'Commands and Queries separated':  'public record CreateUserCommand(String name, String email) {}',
                'Command handlers defined':        '@CommandHandler\npublic void handle(CreateUserCommand cmd) { ... }',
                'Query handlers defined':          '@QueryHandler\npublic UserView handle(GetUserQuery query) { ... }',
                'Read/write models separated':     'Separate UserWriteModel (@Entity) and UserReadModel (projection)',
            }
        },

        'Domain Events': {
            family: 'Enterprise', icon: '📢',
            detect: c => /ApplicationEvent|DomainEvent|extends\s+\w*Event\b/.test(c),
            criteria: [
                { label: 'Events extend ApplicationEvent or DomainEvent', w: 3, test: c => /extends\s+ApplicationEvent|implements\s+DomainEvent/.test(c) },
                { label: 'Events are immutable',                          w: 3, test: c => /final\s+class\s+\w+Event|\brecord\s+\w+Event/.test(c) || /private\s+final\s+/.test(c) },
                { label: 'Published via ApplicationEventPublisher',       w: 3, test: c => /ApplicationEventPublisher|eventPublisher\.publish/.test(c) },
                { label: 'Listeners use @EventListener',                  w: 2, test: c => /@EventListener|@TransactionalEventListener/.test(c) },
            ],
            fixes: {
                'Events extend ApplicationEvent or DomainEvent': 'public class OrderCreatedEvent extends ApplicationEvent { ... }',
                'Events are immutable':                          'public record OrderCreatedEvent(Long orderId, Instant timestamp) {}',
                'Published via ApplicationEventPublisher':       '@Autowired ApplicationEventPublisher publisher;\npublisher.publishEvent(new OrderCreatedEvent(this, id));',
                'Listeners use @EventListener':                  '@EventListener\npublic void onOrderCreated(OrderCreatedEvent e) { ... }',
            }
        },

        Specification: {
            family: 'Enterprise', icon: '🔍',
            detect: c => /Specification<|Predicate<|toPredicate\s*\(/.test(c),
            criteria: [
                { label: 'Implements Specification<T>',     w: 3, test: c => /implements\s+Specification</.test(c) },
                { label: 'toPredicate() implemented',       w: 3, test: c => /Predicate\s+toPredicate\s*\(/.test(c) },
                { label: 'Specifications composable (and/or/not)', w: 3, test: c => /\.and\s*\(|\.or\s*\(|Specification\.not/.test(c) },
            ],
            fixes: {
                'Implements Specification<T>':              'public class ActiveUserSpec implements Specification<User> { ... }',
                'toPredicate() implemented':                '@Override public Predicate toPredicate(Root<User> r, CriteriaQuery<?> q, CriteriaBuilder cb) { ... }',
                'Specifications composable (and/or/not)':  'repo.findAll(Specification.where(isActive()).and(hasEmail(email)))',
            }
        },

        /* ─────────────────── CLOUD / MICROSERVICES ─────────────────── */

        'Circuit Breaker': {
            family: 'Cloud', icon: '⚡',
            detect: c => /@CircuitBreaker|Resilience4j|HystrixCommand|CircuitBreakerFactory/.test(c),
            criteria: [
                { label: '@CircuitBreaker annotation',         w: 3, test: c => /@CircuitBreaker\b/.test(c) },
                { label: 'Fallback method defined',            w: 3, test: c => /fallback\w*Method|fallbackMethod/.test(c) },
                { label: 'Circuit breaker name configured',    w: 2, test: c => /name\s*=\s*"/.test(c) },
                { label: 'Resilience4j dependency used',       w: 2, test: c => /resilience4j|Resilience4j/.test(c) },
                { label: 'Metrics/events recorded',           w: 2, test: c => /CircuitBreakerEvent|onSuccess|onError|Micrometer/.test(c) },
            ],
            fixes: {
                '@CircuitBreaker annotation':       '@CircuitBreaker(name = "userService", fallbackMethod = "fallback")',
                'Fallback method defined':          'public User fallback(Long id, Throwable t) { return User.defaultUser(); }',
                'Circuit breaker name configured':  'resilience4j.circuitbreaker.instances.userService.failureRateThreshold=50',
                'Resilience4j dependency used':     'implementation "io.github.resilience4j:resilience4j-spring-boot3"',
                'Metrics/events recorded':          'Use Micrometer: CircuitBreakerRegistry + actuator/metrics endpoint',
            }
        },

        Retry: {
            family: 'Cloud', icon: '🔄',
            detect: c => /@Retry\b|RetryTemplate|@Retryable|RetryPolicy/.test(c),
            criteria: [
                { label: '@Retryable or @Retry annotation',   w: 3, test: c => /@Retryable|@Retry\b/.test(c) },
                { label: 'Max attempts configured',           w: 3, test: c => /maxAttempts|maxRetryAttempts|maxAttempt/.test(c) },
                { label: 'Exponential backoff configured',    w: 2, test: c => /backoff|Backoff|exponential|multiplier/.test(c) },
                { label: '@Recover / fallback method',        w: 2, test: c => /@Recover|fallback\w*Method/.test(c) },
                { label: 'Retry only on specific exceptions', w: 2, test: c => /value\s*=|include\s*=|retryOn/.test(c) },
            ],
            fixes: {
                '@Retryable or @Retry annotation': '@Retryable(value = {TimeoutException.class}, maxAttempts = 3)',
                'Max attempts configured':         'maxAttempts = 3',
                'Exponential backoff configured':  '@Retryable(..., backoff = @Backoff(delay = 1000, multiplier = 2))',
                '@Recover / fallback method':      '@Recover public User recover(TimeoutException e, Long id) { ... }',
                'Retry only on specific exceptions':'value = {TimeoutException.class, ServiceUnavailableException.class}',
            }
        },

        Bulkhead: {
            family: 'Cloud', icon: '🚧',
            detect: c => /@Bulkhead|BulkheadRegistry|ThreadPoolBulkhead/.test(c),
            criteria: [
                { label: '@Bulkhead annotation',            w: 3, test: c => /@Bulkhead\b/.test(c) },
                { label: 'Bulkhead type specified',         w: 2, test: c => /type\s*=\s*Bulkhead\.Type/.test(c) },
                { label: 'Concurrent call limit configured',w: 3, test: c => /maxConcurrentCalls|maxConcurrent|coreThreadPoolSize/.test(c) },
                { label: 'Fallback on rejection',           w: 2, test: c => /fallback\w*Method|onBulkheadRejection/.test(c) },
            ],
            fixes: {
                '@Bulkhead annotation':             '@Bulkhead(name = "userService", type = Bulkhead.Type.THREADPOOL)',
                'Bulkhead type specified':          'type = Bulkhead.Type.SEMAPHORE or Bulkhead.Type.THREADPOOL',
                'Concurrent call limit configured': 'resilience4j.bulkhead.instances.userService.maxConcurrentCalls=10',
                'Fallback on rejection':            'fallbackMethod = "fallbackResponse"',
            }
        },

        'Rate Limiter': {
            family: 'Cloud', icon: '🚦',
            detect: c => /@RateLimiter|RateLimiterRegistry|TokenBucket/.test(c),
            criteria: [
                { label: '@RateLimiter annotation',         w: 3, test: c => /@RateLimiter\b/.test(c) },
                { label: 'Rate limit configured',           w: 3, test: c => /limitForPeriod|permissionsPerSecond|rateLimit/.test(c) },
                { label: 'Timeout on wait configured',      w: 2, test: c => /limitRefreshPeriod|timeoutDuration/.test(c) },
                { label: 'Fallback on rate exceed',         w: 2, test: c => /fallback\w*Method|RequestNotPermitted/.test(c) },
            ],
            fixes: {
                '@RateLimiter annotation':   '@RateLimiter(name = "api", fallbackMethod = "rateLimitFallback")',
                'Rate limit configured':     'resilience4j.ratelimiter.instances.api.limitForPeriod=10',
                'Timeout on wait configured':'resilience4j.ratelimiter.instances.api.timeoutDuration=0s',
                'Fallback on rate exceed':   'public Response rateLimitFallback(RequestNotPermitted e) { return Response.tooManyRequests(); }',
            }
        },

        'Health Check': {
            family: 'Cloud', icon: '❤️',
            detect: c => /HealthIndicator|HealthContributor|@Endpoint|\/actuator\/health/.test(c),
            criteria: [
                { label: 'Implements HealthIndicator',        w: 3, test: c => /implements\s+HealthIndicator|implements\s+ReactiveHealthIndicator/.test(c) },
                { label: 'health() method returns Health',    w: 3, test: c => /Health\.up\(\)|Health\.down\(\)|Health\.of\(/.test(c) },
                { label: 'Custom health details included',    w: 2, test: c => /withDetail|withStatus/.test(c) },
                { label: 'Spring Actuator enabled',          w: 2, test: c => /spring\.boot\.admin|management\.endpoints|actuator/.test(c) },
            ],
            fixes: {
                'Implements HealthIndicator':      '@Component public class DbHealthIndicator implements HealthIndicator { ... }',
                'health() method returns Health':  '@Override public Health health() { return Health.up().withDetail("db", "connected").build(); }',
                'Custom health details included':  '.withDetail("connections", pool.getActive()).withDetail("queue", pool.getWaiting())',
                'Spring Actuator enabled':         'management.endpoints.web.exposure.include=health,info,metrics',
            }
        },

        'Distributed Tracing': {
            family: 'Cloud', icon: '🔭',
            detect: c => /Tracer|Span|traceId|spanId|Sleuth|Micrometer|OpenTelemetry|@NewSpan/.test(c),
            criteria: [
                { label: 'Tracing instrumented (@NewSpan)',   w: 3, test: c => /@NewSpan|@SpanTag|Tracer\.nextSpan/.test(c) },
                { label: 'Trace/span IDs propagated',         w: 3, test: c => /traceId|spanId|TraceContext|propagation/.test(c) },
                { label: 'Custom span attributes set',         w: 2, test: c => /span\.tag|setAttribute|SpanTag/.test(c) },
                { label: 'Spans closed properly (try-with-resources)', w: 2, test: c => /try\s*\([^)]+span|scope\.close\(\)|span\.end\(\)/.test(c) },
            ],
            fixes: {
                'Tracing instrumented (@NewSpan)':           '@NewSpan("processOrder")\npublic Order process(Order o) { ... }',
                'Trace/span IDs propagated':                 'Spring Cloud Sleuth auto-propagates via HTTP headers',
                'Custom span attributes set':                '@SpanTag("order.id") Long orderId  or span.tag("key", "value")',
                'Spans closed properly (try-with-resources)':'try (Scope s = span.makeCurrent()) { ... } finally { span.end(); }',
            }
        },

        /* ─────────────────── SPRING-SPECIFIC ─────────────────── */

        'Dependency Injection': {
            family: 'Spring', icon: '💉',
            detect: c => /@Autowired|@Inject|@RequiredArgsConstructor|private\s+final\s+\w+Service/.test(c),
            criteria: [
                { label: 'Constructor injection (final fields)', w: 4, test: c => /private\s+final\s+\w+\s+\w+/m.test(c) || /@RequiredArgsConstructor/.test(c) },
                { label: 'No "new" for Spring beans',            w: 3, test: c => !/=\s*new\s+\w+(?:Service|Repository|Component)\b/.test(c) },
                { label: 'Depends on interfaces not impl',       w: 3, test: c => !/private.*\w+Impl\b/.test(c) },
                { label: 'No circular dependency risk',          w: 2, test: c => !/@Lazy/.test(c) },
            ],
            fixes: {
                'Constructor injection (final fields)': '@RequiredArgsConstructor or: private final Service svc; + constructor',
                'No "new" for Spring beans':            'Never new a @Service/@Repository — inject them',
                'Depends on interfaces not impl':       'private final UserService svc; // not UserServiceImpl',
                'No circular dependency risk':          'Break circular deps by refactoring, not @Lazy',
            }
        },

        'AOP': {
            family: 'Spring', icon: '✂️',
            detect: c => /@Aspect|@Before|@After|@Around|@Pointcut/.test(c),
            criteria: [
                { label: '@Aspect + @Component',              w: 3, test: c => /@Aspect/.test(c) && /@Component/.test(c) },
                { label: 'Specific pointcut (not wildcard)',  w: 3, test: c => !/@Pointcut\s*\(\s*"execution\s*\(\s*\*\s+\*\.\*\s*\(/.test(c) },
                { label: 'Advice is thin (no business logic)',w: 3, test: c => !/repository\.|\.save\(|\.delete\(|entityManager/.test(c) },
                { label: 'Pointcut defined separately',       w: 2, test: c => /@Pointcut/.test(c) },
            ],
            fixes: {
                '@Aspect + @Component':              '@Aspect\n@Component\npublic class AuditAspect { ... }',
                'Specific pointcut (not wildcard)': '"execution(* com.example.service.*.*(..))"',
                'Advice is thin (no business logic)':'Keep advice to logging/timing/audit — no domain logic',
                'Pointcut defined separately':       '@Pointcut("execution(* com.example..*(..))") public void serviceLayer() {}',
            }
        },

        'Reactive (WebFlux)': {
            family: 'Spring', icon: '⚛️',
            detect: c => /Mono<|Flux<|WebFlux|@GetMapping.*Mono|@GetMapping.*Flux/.test(c),
            criteria: [
                { label: 'Returns Mono<T> or Flux<T>',      w: 4, test: c => /Mono<|Flux</.test(c) },
                { label: 'No blocking calls inside reactor pipeline',w: 3, test: c => !/(\.block\(\)|\.blockFirst\(\)|\.blockLast\(\)|Thread\.sleep)/.test(c) },
                { label: 'Error handling with onErrorReturn/Resume',w: 2, test: c => /onErrorReturn|onErrorResume|onErrorMap/.test(c) },
                { label: 'Backpressure considered',          w: 2, test: c => /limitRate|buffer|prefetch|onBackpressure/.test(c) },
            ],
            fixes: {
                'Returns Mono<T> or Flux<T>':               'public Mono<User> findById(Long id) { return repo.findById(id); }',
                'No blocking calls inside reactor pipeline': 'Never .block() inside a reactive chain — use flatMap/switchIfEmpty',
                'Error handling with onErrorReturn/Resume':  '.onErrorReturn(defaultUser)  or  .onErrorResume(e -> Mono.just(fallback))',
                'Backpressure considered':                   '.limitRate(100)  or  .onBackpressureDrop()',
            }
        }
    };

    /* =========================================================
       SECTION B — ANTI-PATTERN DETECTION
       ========================================================= */

    const ANTI_PATTERNS = [
        {
            name: 'God Class',
            icon: '👑', severity: 'critical',
            description: 'Class has too many responsibilities — should be split into focused classes.',
            detect: c => {
                const methods = (c.match(/(?:public|private|protected)\s+\w+\s+\w+\s*\(/gm) || []).length;
                const lines   = c.split('\n').length;
                return methods > 20 || lines > 500;
            },
            fix: 'Apply Single Responsibility Principle: split into smaller, focused classes (target ≤10 methods each).'
        },
        {
            name: 'Anemic Domain Model',
            icon: '🧟', severity: 'high',
            description: '@Entity class has only getters/setters with no behaviour — domain logic is scattered in services.',
            detect: c => /@Entity\b/.test(c) &&
                         /(?:get|set)\w+\s*\(/.test(c) &&
                         !/public\s+(?!(?:get|set|equals|hashCode|toString|is)\b)\w+\s+\w+\s*\([^)]*\)(?!\s*\{[\s\n]*return)/.test(c),
            fix: 'Move business logic into the domain entity: order.cancel(), order.calculateTotal() belong ON the Order entity.'
        },
        {
            name: 'Service Locator',
            icon: '📍', severity: 'high',
            description: 'Code pulls dependencies from a registry rather than having them injected — hides dependencies.',
            detect: c => /ServiceLocator\.get|ServiceLocator\.locate|ApplicationContext\.getBean|context\.getBean/.test(c),
            fix: 'Replace ServiceLocator.get(X.class) with constructor injection: private final X service; (let Spring inject it).'
        },
        {
            name: 'Magic Numbers/Strings',
            icon: '🔢', severity: 'medium',
            description: 'Hard-coded literal values without named constants make code hard to understand and maintain.',
            detect: c => {
                const nums = (c.match(/(?<![A-Za-z_])\d{4,}(?![A-Za-z_])/gm) || []).length;
                const strs = (c.match(/"(?!https?:\/\/)[A-Z_]{5,}"/gm) || []).length;
                return nums > 3 || strs > 5;
            },
            fix: 'Extract to named constants: private static final int MAX_RETRY_ATTEMPTS = 3;'
        },
        {
            name: 'Big Controller',
            icon: '🎛️', severity: 'critical',
            description: 'Controller has business logic, repository access, or complex processing — violates MVC.',
            detect: c => /@RestController|@Controller/.test(c) &&
                         (/\w+Repository\s+\w+/.test(c) || /EntityManager/.test(c) ||
                          /\.stream\(\).*\.filter\(/.test(c) || (/\bfor\s*\(/.test(c) && /\bwhile\s*\(/.test(c)))),
            fix: 'Move all logic to @Service layer. Controller should only: (1) map HTTP, (2) call service, (3) return response.'
        },
        {
            name: 'Transaction Script',
            icon: '📜', severity: 'high',
            description: 'Long procedural methods in service doing everything step-by-step — no domain model.',
            detect: c => {
                const longMethods = (c.match(/public\s+\w+\s+\w+\s*\([^)]*\)\s*\{[^}]{800,}/gm) || []).length;
                return longMethods > 0 && /@Service\b/.test(c);
            },
            fix: 'Extract domain objects with behaviour, apply Tell-Don\'t-Ask. Target: methods ≤20 lines, one level of abstraction.'
        },
        {
            name: 'Exception Swallowing',
            icon: '🙈', severity: 'critical',
            description: 'catch block is empty or only has a comment — exceptions disappear silently.',
            detect: c => /catch\s*\([^)]+\)\s*\{\s*(?:\/\/[^\n]*)?\s*\}/m.test(c),
            fix: 'Always log or rethrow: catch (Exception e) { log.error("Failed: {}", e.getMessage(), e); throw new ServiceException("msg", e); }'
        },
        {
            name: 'Singleton Abuse',
            icon: '🔒⚠️', severity: 'medium',
            description: 'Multiple unrelated services declared as Singletons sharing mutable state — hidden coupling.',
            detect: c => (c.match(/getInstance\s*\(/gm) || []).length > 3,
            fix: 'Use Spring @Service (Singletons with DI) instead of manual Singletons. Avoid shared mutable state.'
        },
        {
            name: 'Premature Generalization',
            icon: '🤯', severity: 'low',
            description: 'Over-engineered abstractions for a simple use case — YAGNI violation.',
            detect: c => {
                const generics = (c.match(/<\w+,\s*\w+>/gm) || []).length;
                const abstracts = (c.match(/abstract\s+\w+/gm) || []).length;
                return generics > 5 && abstracts > 3;
            },
            fix: 'YAGNI: implement the simplest thing that works. Add abstraction only when you have 3+ concrete use cases.'
        }
    ];

    /* =========================================================
       SECTION C — FILE ANALYSIS ORCHESTRATOR
       ========================================================= */

    function analyzeFile(filename, code) {
        const patterns  = [];
        const antiPats  = [];
        let   totalScore = 0, totalMax = 0;

        Object.entries(PATTERN_LIBRARY).forEach(([name, def]) => {
            if (!def.detect(code)) return;
            const critResults = def.criteria.map(c => {
                const passed = c.test(code);
                return {
                    label: c.label, passed, weight: c.w,
                    fix: def.fixes[c.label] || ''
                };
            });
            const score  = critResults.reduce((s, c) => s + (c.passed ? c.w : 0), 0);
            const maxSc  = critResults.reduce((s, c) => s + c.w, 0);
            const pct    = maxSc > 0 ? Math.round(score / maxSc * 100) : 100;
            const grade  = pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
            const color  = pct >= 85 ? '#3fb950' : pct >= 70 ? '#d29922' : pct >= 55 ? '#f0883e' : '#f85149';
            totalScore += score;
            totalMax   += maxSc;
            patterns.push({ name, family: def.family, icon: def.icon, grade, color, pct, score, maxSc, criteria: critResults });
        });

        ANTI_PATTERNS.forEach(ap => {
            if (ap.detect(code)) antiPats.push(ap);
        });

        const overallPct   = totalMax > 0 ? Math.round(totalScore / totalMax * 100) : 0;
        const overallGrade = overallPct >= 85 ? 'A' : overallPct >= 70 ? 'B' : overallPct >= 55 ? 'C' : overallPct >= 40 ? 'D' : 'F';
        const overallColor = overallPct >= 85 ? '#3fb950' : overallPct >= 70 ? '#d29922' : overallPct >= 55 ? '#f0883e' : '#f85149';

        return { filename, patterns, antiPats, overallPct, overallGrade, overallColor, totalScore, totalMax };
    }

    /* =========================================================
       SECTION D — UI INJECTION
       ========================================================= */

    function injectUI() {
        /* ── Upload tab button ── */
        const tabBar = document.querySelector('.upload-tabs');
        if (!tabBar || tabBar.querySelector('[data-fcs-tab]')) return;
        const btn = document.createElement('button');
        btn.className = 'upload-tab';
        btn.dataset.fcsTab = '1';
        btn.innerHTML = '🔍 Full Compliance';
        btn.addEventListener('click', activateTab);
        tabBar.appendChild(btn);

        /* ── Tab panel ── */
        const content = document.querySelector('.upload-content');
        if (!content) return;
        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.id = 'fcs-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div style="margin-bottom:1rem">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;
                            background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:4px">
                    <button id="fcs-mode-files" class="btn btn-primary btn-sm" style="justify-content:center"
                        onclick="window._fcsSetMode('files')">📁 Upload Files / Project</button>
                    <button id="fcs-mode-paste" class="btn btn-sm" style="justify-content:center"
                        onclick="window._fcsSetMode('paste')">📝 Paste Code</button>
                </div>

                <!-- Files mode -->
                <div id="fcs-files-mode">
                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
                        <label class="btn" style="cursor:pointer">
                            ☕ Upload .java / .kt files
                            <input id="fcs-file-input" type="file" accept=".java,.kt,.groovy"
                                multiple style="display:none" onchange="window._fcsHandleFiles(this.files)">
                        </label>
                        <label class="btn" style="cursor:pointer">
                            📦 Upload ZIP / JAR / WAR
                            <input id="fcs-zip-input" type="file" accept=".zip,.jar,.war,.ear"
                                style="display:none" onchange="window._fcsHandleZip(this.files[0])">
                        </label>
                        <button class="btn btn-sm" onclick="window._fcsSampleProject()">🧪 Load Sample Project</button>
                    </div>
                    <!-- Drop zone -->
                    <div id="fcs-dropzone" style="border:2px dashed var(--border);border-radius:8px;padding:2.5rem;
                            text-align:center;cursor:pointer;transition:all 0.3s"
                        ondragover="event.preventDefault();this.style.borderColor='#58a6ff';this.style.background='rgba(88,166,255,0.05)'"
                        ondragleave="this.style.borderColor='';this.style.background=''"
                        ondrop="event.preventDefault();this.style.borderColor='';this.style.background='';window._fcsDrop(event)">
                        <div style="font-size:3rem;margin-bottom:0.75rem;opacity:0.4">📂</div>
                        <div style="font-weight:600;margin-bottom:0.25rem">Drag & drop .java files or a ZIP archive</div>
                        <div style="font-size:0.8rem;color:var(--text-muted)">Supports .java · .kt · .groovy · .zip · .jar · .war · .ear</div>
                    </div>
                    <!-- File list -->
                    <div id="fcs-file-list" style="display:none;margin-top:0.75rem;
                            background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;
                            max-height:180px;overflow-y:auto"></div>
                </div>

                <!-- Paste mode -->
                <div id="fcs-paste-mode" style="display:none">
                    <div style="display:flex;gap:0.75rem;margin-bottom:0.5rem;align-items:center;flex-wrap:wrap">
                        <input id="fcs-paste-name" class="paste-input" placeholder="Filename e.g. UserService.java"
                            style="flex:1;min-width:180px;font-size:0.85rem">
                        <select id="fcs-paste-lang" class="language-select">
                            <option value="java">Java</option><option value="kotlin">Kotlin</option>
                        </select>
                    </div>
                    <textarea id="fcs-paste-code" class="code-textarea" rows="12"
                        placeholder="Paste your Java/Spring code here..."></textarea>
                </div>

                <!-- Actions -->
                <div style="display:flex;gap:0.75rem;margin-top:1rem;flex-wrap:wrap;align-items:center">
                    <button class="btn btn-primary" onclick="window._fcsAnalyse()">🔍 Analyse Compliance</button>
                    <button class="btn btn-sm" onclick="window._fcsClear()">🗑 Clear</button>
                    <button class="btn btn-sm" onclick="window._fcsExport()">📄 Export Report</button>
                    <span id="fcs-status" style="font-size:0.8rem;color:var(--text-muted)"></span>
                </div>
            </div>
        `;
        content.appendChild(panel);

        /* ── Results section (below upload area) ── */
        const container = document.querySelector('.container') || document.body;
        const results = document.createElement('div');
        results.id = 'fcs-results-section';
        results.style.display = 'none';
        results.style.marginTop = '2rem';
        results.innerHTML = `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;overflow:hidden">
                <div style="background:var(--bg-tertiary);padding:1rem 1.5rem;border-bottom:1px solid var(--border);
                            display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
                    <div style="font-weight:700;font-size:1.1rem;background:linear-gradient(135deg,#58a6ff,#bc8cff);
                                -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
                        🔍 Full Design Pattern Compliance Report
                    </div>
                    <div style="display:flex;gap:0.5rem">
                        <button class="btn btn-sm" onclick="window._fcsSwitchView('summary')">📊 Summary</button>
                        <button class="btn btn-sm" onclick="window._fcsSwitchView('files')">📁 Per File</button>
                        <button class="btn btn-sm" onclick="window._fcsSwitchView('matrix')">🔢 Matrix</button>
                        <button class="btn btn-sm" onclick="window._fcsExport()">📄 Export</button>
                    </div>
                </div>
                <div id="fcs-summary-view"  style="padding:1.5rem;max-height:80vh;overflow-y:auto"></div>
                <div id="fcs-files-view"    style="padding:1.5rem;max-height:80vh;overflow-y:auto;display:none"></div>
                <div id="fcs-matrix-view"   style="padding:1.5rem;max-height:80vh;overflow-y:auto;display:none"></div>
            </div>
        `;
        /* Insert after upload section */
        const uploadSection = document.querySelector('.upload-section') || content;
        uploadSection.insertAdjacentElement('afterend', results);
    }

    function activateTab() {
        document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
        const btn   = document.querySelector('[data-fcs-tab]');
        const panel = document.getElementById('fcs-panel');
        if (btn)   btn.classList.add('active');
        if (panel) { panel.classList.add('active'); panel.style.display = 'block'; }
    }

    /* =========================================================
       SECTION E — FILE HANDLING
       ========================================================= */

    let _files = []; // { filename, code }

    window._fcsSetMode = function (mode) {
        document.getElementById('fcs-files-mode').style.display = mode === 'files' ? '' : 'none';
        document.getElementById('fcs-paste-mode').style.display = mode === 'paste' ? '' : 'none';
        document.getElementById('fcs-mode-files').className = mode === 'files' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
        document.getElementById('fcs-mode-paste').className = mode === 'paste' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
        document.getElementById('fcs-mode-files').style.justifyContent = 'center';
        document.getElementById('fcs-mode-paste').style.justifyContent = 'center';
    };

    function addFile(filename, code) {
        if (!_files.find(f => f.filename === filename)) _files.push({ filename, code });
        renderFileList();
    }

    function renderFileList() {
        const el = document.getElementById('fcs-file-list');
        if (!el) return;
        if (_files.length === 0) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.innerHTML = _files.map((f, i) => `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 1rem;
                        border-bottom:1px solid var(--border);font-size:0.82rem">
                <span style="color:var(--accent-blue)">☕</span>
                <span style="flex:1;font-family:'Fira Code',monospace">${f.filename}</span>
                <span style="color:var(--text-muted)">${f.code.split('\n').length} lines</span>
                <button onclick="window._fcsRemoveFile(${i})" style="background:none;border:none;
                    color:var(--text-muted);cursor:pointer;font-size:1rem">✕</button>
            </div>`).join('');
        setStatus(`${_files.length} file(s) loaded.`);
    }

    window._fcsRemoveFile = function (i) { _files.splice(i, 1); renderFileList(); };

    window._fcsHandleFiles = function (fileList) {
        Array.from(fileList).forEach(f => {
            const reader = new FileReader();
            reader.onload = e => addFile(f.name, e.target.result);
            reader.readAsText(f);
        });
    };

    window._fcsHandleZip = async function (file) {
        if (!file) return;
        setStatus('Extracting archive…');
        try {
            const JSZip = window.JSZip;
            if (!JSZip) { setStatus('JSZip not available — include jszip.min.js in your HTML.'); return; }
            const zip = await JSZip.loadAsync(file);
            const tasks = [];
            zip.forEach((path, entry) => {
                if (!entry.dir && /\.(java|kt|groovy)$/i.test(path)) {
                    tasks.push(entry.async('string').then(code => addFile(path, code)));
                }
            });
            await Promise.all(tasks);
            setStatus(`Extracted ${tasks.length} source files from ${file.name}`);
        } catch (e) {
            setStatus('Failed to extract archive: ' + e.message);
        }
    };

    window._fcsDrop = function (e) {
        const items = e.dataTransfer.files;
        Array.from(items).forEach(f => {
            if (/\.(zip|jar|war|ear)$/i.test(f.name)) {
                window._fcsHandleZip(f);
            } else if (/\.(java|kt|groovy)$/i.test(f.name)) {
                const r = new FileReader();
                r.onload = ev => addFile(f.name, ev.target.result);
                r.readAsText(f);
            }
        });
    };

    /* ─── Sample project ─── */
    window._fcsSampleProject = function () {
        _files = [];
        const samples = {
            'OrderController.java': `import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/orders")
public class OrderController {
    @Autowired private OrderRepository orderRepository; // VIOLATION
    @PostMapping public Order create(@RequestBody Order order) { // VIOLATION: no @Valid, returns @Entity
        if(order.getAmount() <= 0) throw new RuntimeException("bad"); // business logic in controller
        return orderRepository.save(order);
    }
    @GetMapping("/active") public List<Order> getActive() {
        return orderRepository.findAll().stream().filter(Order::isActive).collect(java.util.stream.Collectors.toList());
    }
}`,
            'UserService.java': `import org.springframework.beans.factory.annotation.Autowired;
import javax.persistence.EntityManager;
public class UserService { // VIOLATION: no @Service
    @Autowired private UserRepository repo; // field injection
    @Autowired private EntityManager em;    // VIOLATION: direct EM in service
    public User create(User u) {
        try { return repo.save(u); } catch(Exception e) { e.printStackTrace(); } // swallowing
        return null;
    }
}`,
            'ProductRepository.java': `import org.springframework.stereotype.Repository;
import javax.persistence.EntityManager;
@Repository
public class ProductRepository { // VIOLATION: class not interface
    private EntityManager em;
    public Product findWithRules(Long id) { // VIOLATION: business logic
        Product p = em.find(Product.class, id);
        if(p == null) throw new RuntimeException("not found");
        if(!p.isAvailable()) throw new RuntimeException("unavailable");
        return p;
    }
    @org.springframework.transaction.annotation.Transactional // VIOLATION: @Transactional in repo
    public void batchUpdate(List<Long> ids) { ids.forEach(id -> em.find(Product.class,id)); }
}`,
            'PaymentService.java': `import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
@Service public class PaymentService {
    private final PaymentRepository paymentRepo;
    private final AuditService auditService;
    public PaymentService(PaymentRepository r, AuditService a){ this.paymentRepo=r; this.auditService=a; }
    @Transactional public Payment process(PaymentDto dto){
        Payment p = paymentRepo.save(new Payment(dto.getAmount()));
        auditService.log("payment", p.getId());
        return p;
    }
}`,
            'NotificationService.java': `import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Service;
@Service public class NotificationService {
    @CircuitBreaker(name="email", fallbackMethod="fallback")
    @Retry(name="email", fallbackMethod="fallback")
    public void sendEmail(String to, String msg){ /* call external API */ }
    public void fallback(String to, String msg, Throwable t){ /* log */ }
}`
        };
        Object.entries(samples).forEach(([n, c]) => addFile(n, c));
        setStatus('Sample project loaded (5 files with mixed violations).');
    };

    /* =========================================================
       SECTION F — ANALYSIS + RENDER
       ========================================================= */

    window._fcsAnalyse = function () {
        const pasteMode = document.getElementById('fcs-paste-mode') &&
                          document.getElementById('fcs-paste-mode').style.display !== 'none';

        if (pasteMode) {
            const code = (document.getElementById('fcs-paste-code') || {}).value || '';
            const name = (document.getElementById('fcs-paste-name') || {}).value || 'Untitled.java';
            if (!code.trim()) { setStatus('⚠️ Paste some code first.'); return; }
            _files = [{ filename: name, code }];
        }

        if (_files.length === 0) { setStatus('⚠️ Upload files or paste code first.'); return; }
        setStatus('Analysing…');

        setTimeout(() => {
            const reports = _files.map(f => analyzeFile(f.filename, f.code));
            window._fcsLastReports = reports;
            renderSummary(reports);
            renderPerFile(reports);
            renderMatrix(reports);
            const sec = document.getElementById('fcs-results-section');
            if (sec) { sec.style.display = ''; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            setStatus(`Done — ${reports.length} file(s) analysed.`);
        }, 50);
    };

    function renderSummary(reports) {
        const el = document.getElementById('fcs-summary-view');
        if (!el) return;

        const totalPatterns   = reports.reduce((s, r) => s + r.patterns.length, 0);
        const totalAnti       = reports.reduce((s, r) => s + r.antiPats.length, 0);
        const avgPct          = reports.length
            ? Math.round(reports.reduce((s, r) => s + r.overallPct, 0) / reports.length) : 0;
        const overallColor    = avgPct >= 80 ? '#3fb950' : avgPct >= 65 ? '#d29922' : avgPct >= 50 ? '#f0883e' : '#f85149';
        const overallGrade    = avgPct >= 85 ? 'A' : avgPct >= 70 ? 'B' : avgPct >= 55 ? 'C' : avgPct >= 40 ? 'D' : 'F';

        // Family aggregation
        const families = {};
        reports.forEach(r => r.patterns.forEach(p => {
            if (!families[p.family]) families[p.family] = { total: 0, score: 0, max: 0 };
            families[p.family].total++;
            families[p.family].score += p.score;
            families[p.family].max   += p.maxSc;
        }));

        const familyIcons = { Creational:'🌱', Structural:'🏗️', Behavioral:'🔄', Enterprise:'🏢', Cloud:'☁️', Spring:'🍃' };
        const familyRows  = Object.entries(families).map(([fam, data]) => {
            const pct = data.max > 0 ? Math.round(data.score / data.max * 100) : 0;
            const col = pct >= 80 ? '#3fb950' : pct >= 65 ? '#d29922' : pct >= 50 ? '#f0883e' : '#f85149';
            return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid rgba(48,54,61,0.5)">
                <span style="font-size:1.1rem;width:1.5rem">${familyIcons[fam] || '📦'}</span>
                <span style="flex:1;font-weight:600;font-size:0.88rem">${fam}</span>
                <span style="font-size:0.75rem;color:var(--text-muted)">${data.total} pattern${data.total !== 1 ? 's' : ''}</span>
                <div style="width:100px;height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${col};border-radius:3px"></div>
                </div>
                <span style="font-weight:700;color:${col};min-width:36px;text-align:right">${pct}%</span>
            </div>`;
        }).join('');

        // Critical violations across all files
        const criticalAnti = reports.flatMap(r => r.antiPats.filter(a => a.severity === 'critical').map(a => ({...a, file: r.filename})));
        const critHtml = criticalAnti.length ? `
            <div style="margin-top:1.5rem">
                <div style="font-size:1rem;font-weight:700;color:#f85149;margin-bottom:0.75rem">🚨 Critical Anti-Patterns (${criticalAnti.length})</div>
                ${criticalAnti.map(a => `
                    <div style="background:#1a0808;border:1px solid rgba(248,81,73,0.35);border-radius:8px;padding:0.875rem;margin-bottom:0.5rem">
                        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.35rem">
                            <span>${a.icon}</span>
                            <span style="font-weight:600;color:#f85149">${a.name}</span>
                            <span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto">in ${a.file}</span>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.35rem">${a.description}</div>
                        <div style="font-size:0.74rem;color:#3fb950;font-family:'Fira Code',monospace;border-left:2px solid #3fb950;padding-left:0.5rem">💡 ${a.fix}</div>
                    </div>`).join('')}
            </div>` : '';

        // Pattern grade table
        const allPatterns = reports.flatMap(r => r.patterns.map(p => ({...p, file: r.filename})));
        const patternGrades = allPatterns.map(p => `
            <div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid rgba(48,54,61,0.4)">
                <span>${p.icon}</span>
                <span style="font-size:0.8rem;flex:1">${p.name}</span>
                <span style="font-size:0.7rem;color:var(--text-muted)">${p.file}</span>
                <span style="font-weight:800;color:${p.color};min-width:1.5rem;text-align:center">${p.grade}</span>
                <span style="font-size:0.72rem;color:${p.color}">${p.pct}%</span>
            </div>`).join('');

        el.innerHTML = `
            <!-- Score hero -->
            <div style="display:grid;grid-template-columns:auto 1fr;gap:1.5rem;
                        align-items:center;background:var(--bg-tertiary);border:1px solid var(--border);
                        border-radius:12px;padding:1.5rem;margin-bottom:1.5rem">
                <div style="text-align:center">
                    <div style="font-size:4rem;font-weight:900;color:${overallColor};line-height:1">${overallGrade}</div>
                    <div style="font-size:1.2rem;font-weight:700;color:${overallColor}">${avgPct}%</div>
                    <div style="font-size:0.68rem;color:var(--text-muted);margin-top:0.2rem">OVERALL</div>
                </div>
                <div>
                    <div style="height:10px;background:var(--bg-primary);border-radius:5px;overflow:hidden;margin-bottom:1rem">
                        <div style="height:100%;width:${avgPct}%;background:${overallColor};border-radius:5px;transition:width 0.5s"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem">
                        ${[
                            ['Files',    reports.length,   '#58a6ff'],
                            ['Patterns', totalPatterns,    '#bc8cff'],
                            ['Families', Object.keys(families).length, '#3fb950'],
                            ['Anti-Pat', totalAnti,        totalAnti > 0 ? '#f85149' : '#3fb950'],
                        ].map(([l,v,c]) => `
                            <div style="background:var(--bg-primary);border:1px solid var(--border);
                                        border-radius:6px;padding:0.6rem;text-align:center">
                                <div style="font-size:1.5rem;font-weight:700;color:${c}">${v}</div>
                                <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase">${l}</div>
                            </div>`).join('')}
                    </div>
                </div>
            </div>

            <!-- Family breakdown -->
            <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:1rem 1.25rem;margin-bottom:1.5rem">
                <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem">Pattern Family Compliance</div>
                ${familyRows || '<div style="color:var(--text-muted);font-size:0.85rem">No patterns detected.</div>'}
            </div>

            <!-- Pattern grades list -->
            ${allPatterns.length ? `
            <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:1rem 1.25rem;margin-bottom:1.5rem">
                <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem">All Detected Patterns — Grades</div>
                ${patternGrades}
            </div>` : ''}

            ${critHtml}

            <!-- All anti-patterns -->
            ${totalAnti > 0 ? `
            <div style="margin-top:1rem">
                <div style="font-size:1rem;font-weight:700;color:var(--accent-yellow);margin-bottom:0.75rem">⚠️ All Anti-Patterns (${totalAnti})</div>
                ${reports.flatMap(r => r.antiPats.map(a => ({...a, file: r.filename}))).map(a => {
                    const col = a.severity==='critical'?'#f85149':a.severity==='high'?'#f0883e':a.severity==='medium'?'#d29922':'#58a6ff';
                    return `<div style="background:var(--bg-tertiary);border:1px solid var(--border);border-left:3px solid ${col};border-radius:8px;padding:0.875rem;margin-bottom:0.5rem">
                        <div style="display:flex;gap:0.6rem;align-items:center;margin-bottom:0.3rem">
                            <span>${a.icon}</span>
                            <span style="font-weight:600;color:${col}">${a.name}</span>
                            <span style="padding:0.1rem 0.45rem;border-radius:10px;font-size:0.65rem;font-weight:700;
                                         background:${col}33;color:${col}">${a.severity.toUpperCase()}</span>
                            <span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto">${a.file}</span>
                        </div>
                        <div style="font-size:0.79rem;color:var(--text-secondary);margin-bottom:0.35rem">${a.description}</div>
                        <div style="font-size:0.73rem;color:#3fb950;font-family:'Fira Code',monospace;border-left:2px solid #3fb950;padding-left:0.5rem">💡 ${a.fix}</div>
                    </div>`;
                }).join('')}
            </div>` : ''}
        `;
    }

    function renderPerFile(reports) {
        const el = document.getElementById('fcs-files-view');
        if (!el) return;
        el.innerHTML = reports.map(r => {
            const critRows = r.patterns.map(p => {
                const failing = p.criteria.filter(c => !c.passed);
                if (failing.length === 0) return '';
                return `<div style="margin-bottom:0.75rem">
                    <div style="font-size:0.8rem;font-weight:600;color:${p.color};margin-bottom:0.3rem">${p.icon} ${p.name} — ${p.pct}% (${p.grade})</div>
                    ${failing.map(c => `
                        <div style="font-size:0.76rem;color:var(--text-secondary);padding:0.25rem 0 0.25rem 0.6rem;
                                    border-left:2px solid #f85149;margin-bottom:0.25rem">
                            ❌ ${c.label}
                            ${c.fix ? `<div style="color:#3fb950;font-family:'Fira Code',monospace;margin-top:0.2rem;font-size:0.7rem">💡 ${c.fix}</div>` : ''}
                        </div>`).join('')}
                </div>`;
            }).join('');

            return `
                <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-left:3px solid ${r.overallColor};
                            border-radius:8px;margin-bottom:1rem;overflow:hidden">
                    <div style="padding:0.875rem 1rem;display:flex;align-items:center;gap:0.75rem;cursor:pointer;
                                border-bottom:1px solid var(--border)"
                         onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
                        <span style="font-family:'Fira Code',monospace;font-size:0.85rem;flex:1;color:var(--accent-blue)">${r.filename}</span>
                        <span style="font-size:0.75rem;color:var(--text-muted)">${r.patterns.length} patterns · ${r.antiPats.length} anti-pat</span>
                        <span style="font-weight:800;color:${r.overallColor}">${r.overallGrade} ${r.overallPct}%</span>
                        <span style="color:var(--text-muted)">▾</span>
                    </div>
                    <div style="padding:1rem;display:none">
                        ${critRows || '<div style="color:#3fb950;font-size:0.82rem">✅ All pattern criteria passing.</div>'}
                        ${r.antiPats.length ? `<div style="margin-top:0.75rem;font-size:0.8rem;font-weight:600;color:#d29922">Anti-patterns: ${r.antiPats.map(a=>`${a.icon} ${a.name}`).join(' · ')}</div>` : ''}
                    </div>
                </div>`;
        }).join('') || '<div style="color:var(--text-muted);text-align:center;padding:2rem">No files analysed yet.</div>';
    }

    function renderMatrix(reports) {
        const el = document.getElementById('fcs-matrix-view');
        if (!el) return;

        const allPats = [...new Set(reports.flatMap(r => r.patterns.map(p => p.name)))];
        if (allPats.length === 0) { el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:2rem">No patterns detected.</div>'; return; }

        const headerCells = allPats.map(n => {
            const def = PATTERN_LIBRARY[n];
            return `<th style="writing-mode:vertical-rl;transform:rotate(180deg);padding:0.5rem 0.35rem;
                             font-size:0.7rem;font-weight:600;white-space:nowrap">${def ? def.icon : ''} ${n}</th>`;
        }).join('');

        const rows = reports.map(r => {
            const cells = allPats.map(pName => {
                const found = r.patterns.find(p => p.name === pName);
                if (!found) return `<td style="text-align:center;color:var(--text-muted);font-size:0.8rem">—</td>`;
                const col = found.color;
                return `<td style="text-align:center">
                    <span style="display:inline-block;padding:0.15rem 0.4rem;border-radius:4px;
                                 background:${col}22;color:${col};font-size:0.72rem;font-weight:700">${found.grade}</span>
                </td>`;
            }).join('');
            return `<tr>
                <td style="padding:0.5rem 0.75rem;font-family:'Fira Code',monospace;font-size:0.73rem;
                           white-space:nowrap;border-right:1px solid var(--border);color:var(--accent-blue)">${r.filename}</td>
                ${cells}
                <td style="text-align:center;font-weight:700;color:${r.overallColor}">${r.overallGrade}</td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px">
                <table style="border-collapse:collapse;min-width:100%">
                    <thead>
                        <tr style="background:var(--bg-tertiary)">
                            <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;
                                       border-right:1px solid var(--border);white-space:nowrap">File</th>
                            ${headerCells}
                            <th style="padding:0.5rem 0.35rem;font-size:0.7rem;white-space:nowrap">Overall</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div style="margin-top:0.75rem;font-size:0.72rem;color:var(--text-muted)">
                A=≥85% &nbsp; B=≥70% &nbsp; C=≥55% &nbsp; D=≥40% &nbsp; F=&lt;40% &nbsp; —=not detected
            </div>`;
    }

    window._fcsSwitchView = function (view) {
        ['summary','files','matrix'].forEach(v => {
            const el = document.getElementById(`fcs-${v}-view`);
            if (el) el.style.display = v === view ? '' : 'none';
        });
    };

    window._fcsClear = function () {
        _files = [];
        renderFileList();
        const sec = document.getElementById('fcs-results-section');
        if (sec) sec.style.display = 'none';
        const inp = document.getElementById('fcs-paste-code');
        if (inp) inp.value = '';
        setStatus('Cleared.');
    };

    window._fcsExport = function () {
        const reports = window._fcsLastReports;
        if (!reports || reports.length === 0) { setStatus('Nothing to export yet.'); return; }
        const summaryEl = document.getElementById('fcs-summary-view');
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>Full Compliance Report ${new Date().toLocaleDateString()}</title>
            <style>body{font-family:Arial,sans-serif;background:#0d1117;color:#c9d1d9;padding:2rem;max-width:1200px;margin:0 auto}
            h1{color:#58a6ff} div{line-height:1.6}</style></head>
            <body><h1>🔍 Full Java/Spring Design Pattern Compliance Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            ${summaryEl ? summaryEl.innerHTML : ''}
            </body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `compliance-report-${Date.now()}.html`;
        a.click();
    };

    function setStatus(msg) {
        const el = document.getElementById('fcs-status');
        if (el) el.textContent = msg;
    }

    /* =========================================================
       SECTION G — INIT
       ========================================================= */

    function injectCSS() {
        const s = document.createElement('style');
        s.textContent = `
            #fcs-panel { display: none; }
            #fcs-panel.active { display: block; }
            #fcs-results-section { display: none; }
            #fcs-files-view, #fcs-matrix-view { display: none; }
        `;
        document.head.appendChild(s);
    }

    function init() {
        injectCSS();
        injectUI();
        console.info('[Full Compliance] ✅ Loaded —',
            Object.keys(PATTERN_LIBRARY).length, 'patterns,',
            ANTI_PATTERNS.length, 'anti-patterns.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
