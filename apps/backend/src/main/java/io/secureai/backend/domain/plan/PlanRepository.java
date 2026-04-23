package io.secureai.backend.domain.plan;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PlanRepository extends JpaRepository<Plan, Short> {
    Optional<Plan> findByName(String name);
}
