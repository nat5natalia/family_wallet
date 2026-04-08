package com.vtbfamily.group.service

import com.vtbfamily.group.model.Group
import com.vtbfamily.group.model.Member
import com.vtbfamily.group.repository.GroupRepository
import com.vtbfamily.group.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.*

@Service
class GroupService(
    private val groupRepository: GroupRepository,
    private val memberRepository: MemberRepository
) {
    
    @Transactional
    fun createGroup(name: String, ownerId: UUID, tariffTier: String): Group {
        val group = Group(
            name = name,
            ownerId = ownerId,
            tariffTier = tariffTier
        )
        val savedGroup = groupRepository.save(group)
        
        val organizer = Member(
            groupId = savedGroup.id,
            userId = ownerId,
            role = "ORGANIZER",
            canRequestMoney = true,
            canManageLimits = true
        )
        memberRepository.save(organizer)
        
        return savedGroup
    }
    
    fun getAllGroups(): List<Group> = groupRepository.findAll()
    
    fun getGroup(id: UUID): Optional<Group> = groupRepository.findById(id)
}