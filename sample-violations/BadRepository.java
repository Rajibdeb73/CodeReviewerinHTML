import org.springframework.stereotype.Repository;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

// DELIBERATELY BAD — will FAIL Repository adherence checks
// Violations: business logic in repo, raw EntityManager, @Transactional in repo, class not interface

@Repository
public class UserRepository {   // VIOLATION: should be an interface extending JpaRepository

    @PersistenceContext
    private EntityManager em;

    // VIOLATION: business logic (rules + decisions) inside the repository layer
    public User findAndValidateUser(Long id) {
        User user = em.find(User.class, id);
        if (user == null) {
            throw new RuntimeException("User not found");  // business rule in repo!
        }
        if (!user.isActive()) {
            throw new RuntimeException("Account disabled");  // another business rule
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
}
