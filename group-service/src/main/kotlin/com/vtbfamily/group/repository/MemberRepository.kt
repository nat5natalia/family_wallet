package com.vtbfamily.group.repository

import com.vtbfamily.group.model.Member
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.*

@Repository
interface MemberRepository : JpaRepository<Member, UUID> {
    fun findByGroupId(groupId: UUID): List<Member>
}