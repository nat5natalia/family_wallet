package com.vtbfamily.group.model

import jakarta.persistence.*
import java.time.LocalDateTime
import java.util.*

@Entity
@Table(name = "members", schema = "family_wallet")
data class Member(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID = UUID.randomUUID(),
    
    @Column(name = "group_id", nullable = false)
    var groupId: UUID,
    
    @Column(name = "user_id", nullable = false)
    var userId: UUID,
    
    @Column(nullable = false)
    var role: String,
    
    @Column(name = "can_request_money")
    var canRequestMoney: Boolean = false,
    
    @Column(name = "can_manage_limits")
    var canManageLimits: Boolean = false,
    
    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now()
)