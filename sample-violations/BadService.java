import org.springframework.beans.factory.annotation.Autowired;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;

// DELIBERATELY BAD — will FAIL Service Layer adherence checks
// Violations: missing @Service, direct JDBC/EntityManager, no @Transactional,
//             creating beans with 'new', field injection instead of constructor injection

// VIOLATION: No @Service annotation — Spring cannot discover or manage this bean
public class OrderService {

    // VIOLATION: Field injection — cannot unit-test without spinning up Spring context
    @Autowired
    private ProductRepository productRepository;

    // VIOLATION: Direct EntityManager in Service — should only exist in Repository
    @PersistenceContext
    private EntityManager entityManager;

    // VIOLATION: No @Transactional — DB writes will not roll back on exception
    public void processOrder(Long orderId) {

        // VIOLATION: Raw JDBC connection inside a Service — bypasses ORM and transaction management
        try {
            Connection conn = DriverManager.getConnection(
                "jdbc:mysql://localhost:3306/shopdb", "root", "p@ssw0rd");
            PreparedStatement ps = conn.prepareStatement(
                "UPDATE orders SET status='PROCESSED' WHERE id=?");
            ps.setLong(1, orderId);
            ps.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace(); // VIOLATION: swallowing exceptions — silent failure
        }

        // VIOLATION: Creating a Spring bean with 'new' — bypasses IoC container (no proxies, no lifecycle)
        UserRepository userRepo = new UserRepository();

        // VIOLATION: Direct EntityManager usage in Service layer
        Order order = entityManager.find(Order.class, orderId);
        if (order != null) {
            order.setStatus("PROCESSED");
            entityManager.merge(order);
        }
    }
}
